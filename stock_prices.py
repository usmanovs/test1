"""Utility for fetching stock prices and saving them to a CSV file."""

from __future__ import annotations

import csv
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Iterable, Sequence

YAHOO_FINANCE_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"


def _normalise_symbols(symbols: Iterable[str]) -> list[str]:
    """Return a list of unique, upper-cased symbols in the order they appear."""

    normalised: list[str] = []
    seen = set()
    for raw_symbol in symbols:
        symbol = raw_symbol.strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        normalised.append(symbol)
    return normalised


def fetch_stock_prices(symbols: Sequence[str]) -> list[dict[str, object]]:
    """Fetch the latest stock price information for the provided ``symbols``.

    Parameters
    ----------
    symbols:
        A sequence of stock ticker symbols. Items are normalised to uppercase and
        duplicates or empty strings are ignored.

    Returns
    -------
    list of dict
        A list of dictionaries with keys ``symbol``, ``price`` (a float),
        ``currency`` and ``timestamp`` (a ``datetime`` instance). The list is
        empty if no data could be retrieved.

    Raises
    ------
    ValueError
        If the input ``symbols`` is empty after normalisation.
    RuntimeError
        If the remote service returns an error or cannot be reached.
    """

    normalised_symbols = _normalise_symbols(symbols)
    if not normalised_symbols:
        raise ValueError("No valid stock symbols were provided.")

    params = urllib.parse.urlencode({"symbols": ",".join(normalised_symbols)})
    url = f"{YAHOO_FINANCE_QUOTE_URL}?{params}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            if response.status != 200:
                raise RuntimeError(
                    f"Yahoo Finance API returned unexpected status: {response.status}"
                )
            payload = json.load(response)
    except urllib.error.URLError as exc:  # pragma: no cover - network errors
        raise RuntimeError("Failed to fetch stock data") from exc

    result = payload.get("quoteResponse", {}).get("result", [])
    prices: list[dict[str, object]] = []

    for entry in result:
        symbol = entry.get("symbol")
        price = entry.get("regularMarketPrice")
        currency = entry.get("currency")
        timestamp = entry.get("regularMarketTime")
        if symbol is None or price is None:
            continue
        prices.append(
            {
                "symbol": symbol,
                "price": float(price),
                "currency": currency or "",
                "timestamp": datetime.fromtimestamp(timestamp) if timestamp else None,
            }
        )

    return prices


def save_prices_to_csv(prices: Sequence[dict[str, object]], csv_path: str | pathlib.Path) -> None:
    """Persist ``prices`` to ``csv_path`` using UTF-8 encoding."""

    path = pathlib.Path(csv_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = ["symbol", "price", "currency", "timestamp"]
    with path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for price in prices:
            row = {name: price.get(name, "") for name in fieldnames}
            timestamp = row["timestamp"]
            if isinstance(timestamp, datetime):
                row["timestamp"] = timestamp.isoformat()
            writer.writerow(row)


def fetch_and_save_stock_prices(
    symbols: Sequence[str], csv_path: str | pathlib.Path
) -> list[dict[str, object]]:
    """Fetch stock prices for ``symbols`` and save them to ``csv_path``.

    The fetched price data is returned to allow the caller to use it immediately
    without reading back from disk.
    """

    prices = fetch_stock_prices(symbols)
    save_prices_to_csv(prices, csv_path)
    return prices


def main() -> None:
    """Command-line interface for fetching and storing stock prices."""

    import argparse

    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument(
        "symbols",
        nargs="+",
        help="One or more stock ticker symbols (e.g. AAPL, MSFT)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="stock_prices.csv",
        help="Destination CSV file path (defaults to stock_prices.csv)",
    )
    args = parser.parse_args()

    prices = fetch_and_save_stock_prices(args.symbols, args.output)
    print(f"Saved {len(prices)} price entries to {args.output}")


__all__ = [
    "fetch_stock_prices",
    "fetch_and_save_stock_prices",
    "save_prices_to_csv",
    "main",
]
