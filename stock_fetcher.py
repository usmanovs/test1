"""Utility for fetching stock prices and exporting them to a CSV file."""

from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Mapping

import requests


class StockPriceFetchError(RuntimeError):
    """Raised when a remote API request fails."""


def fetch_stock_prices(
    symbol: str,
    api_key: str,
    *,
    output_csv: Path | str,
    session: requests.Session | None = None,
) -> Path:
    """Fetch daily adjusted stock prices and save them to a CSV file.

    The function uses the Alpha Vantage ``TIME_SERIES_DAILY_ADJUSTED`` endpoint.

    Args:
        symbol: Stock ticker symbol (e.g. ``"AAPL"``).
        api_key: Alpha Vantage API key.
        output_csv: Destination path for the resulting CSV file.
        session: Optional ``requests.Session`` to reuse an existing HTTP session.

    Returns:
        The path to the written CSV file.

    Raises:
        StockPriceFetchError: If the API call fails or returns an error message.
    """

    http = session or requests.Session()
    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "apikey": api_key,
        "outputsize": "compact",
    }

    response = http.get("https://www.alphavantage.co/query", params=params, timeout=10)
    if not response.ok:
        raise StockPriceFetchError(
            f"Failed to fetch stock prices for {symbol}: HTTP {response.status_code}"
        )

    payload: Mapping[str, object] = response.json()
    if "Error Message" in payload:
        raise StockPriceFetchError(f"API error for {symbol}: {payload['Error Message']}")

    series_key = "Time Series (Daily)"
    if series_key not in payload:
        raise StockPriceFetchError(
            f"Unexpected response structure. Missing '{series_key}' key."
        )

    entries: Mapping[str, Mapping[str, str]] = payload[series_key]

    rows = [
        {
            "date": datetime.strptime(date_str, "%Y-%m-%d").date().isoformat(),
            "open": day_data["1. open"],
            "high": day_data["2. high"],
            "low": day_data["3. low"],
            "close": day_data["4. close"],
            "adjusted_close": day_data["5. adjusted close"],
            "volume": day_data["6. volume"],
        }
        for date_str, day_data in sorted(entries.items(), reverse=True)
    ]

    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=(
                "date",
                "open",
                "high",
                "low",
                "close",
                "adjusted_close",
                "volume",
            ),
        )
        writer.writeheader()
        writer.writerows(rows)

    return output_path


__all__ = ["fetch_stock_prices", "StockPriceFetchError"]
