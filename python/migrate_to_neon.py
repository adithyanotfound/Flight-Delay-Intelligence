#!/usr/bin/env python3
"""
migrate_to_neon.py - High-Speed Migration of BTS Flight Data to Neon PostgreSQL
Migrates all indexed records from local SQLite (data/flights.db) to Neon DB using COPY STDIN.
"""

import os
import sys
import time
import io
import sqlite3
import psycopg2

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "flights.db")

def get_postgres_url():
    if os.environ.get("POSTGRES_URL"):
        return os.environ.get("POSTGRES_URL")
    
    for env_file in [os.path.join(BASE_DIR, ".env"), os.path.join(BASE_DIR, "python", ".env")]:
        if os.path.exists(env_file):
            with open(env_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("POSTGRES_URL="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def migrate():
    url = get_postgres_url()
    if not url:
        print("ERROR: POSTGRES_URL not found in environment or .env files.")
        sys.exit(1)

    print("Connecting to Neon PostgreSQL...")
    pg_conn = psycopg2.connect(url)
    pg_cur = pg_conn.cursor()

    # Clean previous data
    print("Resetting Neon flights table...")
    pg_cur.execute("TRUNCATE TABLE flights RESTART IDENTITY CASCADE;")
    pg_conn.commit()

    print(f"Reading from local SQLite: {DB_PATH}...")
    sq_conn = sqlite3.connect(DB_PATH)
    sq_cur = sq_conn.cursor()

    sq_cur.execute("SELECT COUNT(*) FROM flights")
    total_rows = sq_cur.fetchone()[0]
    print(f"Total flights to migrate: {total_rows:,}")

    sq_cur.execute("""
    SELECT FlightDate, Year, Month, DayofMonth, DayOfWeek, Reporting_Airline, Origin, Dest,
           CRSDepTime, DepDelay, CRSArrTime, ArrDelay, ArrDel15, Cancelled, Distance,
           CarrierDelay, WeatherDelay, NASDelay, SecurityDelay, LateAircraftDelay, DepHour
    FROM flights
    """)

    batch_size = 50000
    migrated = 0
    t_start = time.time()

    copy_sql = """
    COPY flights (flightdate, year, month, dayofmonth, dayofweek, reporting_airline, origin, dest,
                  crsdeptime, depdelay, crsarrtime, arrdelay, arrdel15, cancelled, distance,
                  carrierdelay, weatherdelay, nasdelay, securitydelay, lateaircraftdelay, dephour)
    FROM STDIN WITH (FORMAT csv, NULL '')
    """

    while True:
        rows = sq_cur.fetchmany(batch_size)
        if not rows:
            break

        buf = io.StringIO()
        for r in rows:
            line = ','.join(['' if v is None else str(v) for v in r])
            buf.write(line + '\n')
        buf.seek(0)

        pg_cur.copy_expert(copy_sql, buf)
        pg_conn.commit()

        migrated += len(rows)
        pct = (migrated / total_rows) * 100
        elapsed = time.time() - t_start
        speed = migrated / max(0.1, elapsed)
        print(f"[{pct:5.1f}%] Migrated {migrated:,} / {total_rows:,} rows ({speed:.0f} rows/s)...")

    sq_conn.close()

    # Validate final state
    pg_cur.execute("SELECT COUNT(*), MIN(flightdate), MAX(flightdate) FROM flights")
    cnt, min_d, max_d = pg_cur.fetchone()
    print("\n Migration Complete!")
    print(f"Neon Flight Count: {cnt:,}")
    print(f"Date Horizon: {min_d} to {max_d}")
    
    pg_conn.close()

if __name__ == "__main__":
    migrate()
