# Microsoft Power BI Desktop: Implementation & Setup Guide

This guide walks you through importing the star-schema data, applying the custom theme, adding the DAX measures, and configuring the visuals in **Microsoft Power BI Desktop** to match the **Flight Delay Intelligence** dashboard.

---

## 1. Data Model & Architecture (Star-Schema)

The Power BI package includes four pre-processed tables located in the `powerbi/` folder:

| Table File | Type | Description | Primary / Foreign Key |
| :--- | :--- | :--- | :--- |
| `fact_flights.csv` | **Fact** | 60,000 real BTS flight records with flight times, delay minutes, and cancellation status | `FlightID` (PK), `DateKey` (FK), `Reporting_Airline` (FK), `Origin` (FK) |
| `dim_airline.csv` | **Dimension** | Carrier codes and formal airline names (AA, DL, UA, WN, etc.) | `CarrierCode` (PK) |
| `dim_airport.csv` | **Dimension** | Airport metadata, latitude, longitude, and hub delay tier (ATL, ORD, DFW, etc.) | `AirportCode` (PK) |
| `dim_date.csv` | **Dimension** | Calendar table covering all 365 days of 2023 with month, day, quarter, day of week | `DateKey` (PK) |

### Relationship Setup in Model View
1. Open **Power BI Desktop** $\rightarrow$ **Get Data** $\rightarrow$ **Text/CSV**.
2. Load all 4 CSV files into your data model.
3. Switch to the **Model View** (left pane) and connect relationships:
   - `fact_flights[DateKey]` $\rightarrow$ `dim_date[DateKey]` (Many-to-One `*:1`, Single direction)
   - `fact_flights[Reporting_Airline]` $\rightarrow$ `dim_airline[CarrierCode]` (Many-to-One `*:1`, Single direction)
   - `fact_flights[Origin]` $\rightarrow$ `dim_airport[AirportCode]` (Many-to-One `*:1`, Single direction)

---

## 2. Apply Custom Theme

1. In the Power BI Desktop ribbon, click **View** $\rightarrow$ **Themes** dropdown $\rightarrow$ **Browse for themes**.
2. Select [`powerbi/flight_delay_theme.json`](file:///Users/adithya/Documents/Flight-delay-analysis/powerbi/flight_delay_theme.json).
3. This applies the custom navy-blue aviation palette, modern typography, card drop-shadows, and card radius.

---

## 3. Create DAX Measures

1. In the **Modeling** tab, click **New Measure**.
2. Copy and paste the measures from [`powerbi/flight_delay_measures.dax`](file:///Users/adithya/Documents/Flight-delay-analysis/powerbi/flight_delay_measures.dax). Key measures include:
   - `[On-Time Arrival %]`
   - `[Avg Arrival Delay (min)]`
   - `[Avg Departure Delay (min)]`
   - `[Cancellation Rate %]`
   - `[Total Flights]`
   - `[Air Carrier Delay %]`, `[Late Aircraft Delay %]`, `[NAS Delay %]`, `[Weather Delay %]`

---

## 4. Visual Layout Configuration

Replicate the 4 visual bands matching the dashboard layout:

1. **Top KPI Cards (5 Cards)**:
   - Multi-row cards or individual Card visuals bound to `[On-Time Arrival %]`, `[Avg Arrival Delay]`, `[Avg Departure Delay]`, `[Cancellation Rate %]`, and `[Total Flights]`.
2. **On-Time Performance Trend (Line and Clustered Column Chart)**:
   - Shared Axis: `dim_date[MonthShort]`
   - Column values: `[Avg Arrival Delay (min)]`
   - Line values: `[On-Time Arrival %]`
3. **Delay Drivers (Bar Chart)**:
   - Clustered Bar Chart of delay causes sorted descending.
4. **Delay Concentration by Airport (Map Visual)**:
   - Location: `dim_airport[AirportCode]`
   - Latitude: `dim_airport[Latitude]`, Longitude: `dim_airport[Longitude]`
   - Bubble Size: `[Avg Arrival Delay (min)]`
   - Color saturation / conditional formatting based on `dim_airport[HubTier]`.
5. **Delay by Day & Departure Hour (Matrix Visual with Heatmap Conditional Formatting)**:
   - Rows: `dim_date[DayName]`
   - Columns: `fact_flights[DepHour]`
   - Values: `[Avg Arrival Delay (min)]`
   - Conditional Formatting: Background color gradient from light cream to deep red.
6. **Departure Delay vs Arrival Delay (Scatter Chart)**:
   - X-Axis: `fact_flights[DepDelay]`
   - Y-Axis: `fact_flights[ArrDelay]`
   - Add trend line from Analytics pane ($R^2 = 0.72$).
7. **Slicers (Left Sidebar)**:
   - Slicer 1: `dim_date[FullDate]` (Between / Slider mode)
   - Slicer 2: `dim_airline[AirlineName]` (Dropdown)
   - Slicer 3: `dim_airport[AirportCode]` (Dropdown)
   - Slicer 4: `dim_date[DayName]` (Dropdown)
   - Slicer 5: `fact_flights[DepHour]` (Dropdown)
