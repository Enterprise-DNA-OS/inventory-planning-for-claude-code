# Bring Netstock records across

Checked 10 October 2026. Netstock documents a stock report for each location: open Dashboard, drill into Stock Holding, and use the CSV or Excel download button. Each export is limited to 20,000 records; split larger sets with filters. [Vendor export instructions](https://help.netstock.com/en/articles/12470749-how-to-download-all-items). Choose CSV for this importer.

Keep the original export private in imports/. The vendor documents Value, Model value, Days on hand and Stock turns, but does not promise a fixed complete header schema. [Report columns](https://help.netstock.com/en/articles/12470747-how-to-access-the-full-stock-holding-report). Inspect your actual headers before importing. fixtures/netstock.csv is a synthetic mapping fixture, not a claimed real customer export.

```bash
npm run migrate
npm run planning -- import netstock --file=imports/stock.csv --location=Auckland --actor="Your name" --dry-run
npm run planning -- import netstock --file=imports/stock.csv --location=Auckland --actor="Your name"
```

Item code, Code, Item or SKU identifies the item. Location or Warehouse identifies the site; --location supplies it for a location-specific report. Description maps to name. Value and Model value are retained separately as source_value and source_model_value. Every original column is retained in source, including Days on hand and Stock turns. The file hash, row count, name and actor are stored in imports. The mapping file maps destination names to actual header names; see fixtures/field-map.json and use --map=imports/map.json.

Optional mapped fields are on_hand (Stock on hand, On hand, Quantity), allocated, unit_cost (Unit cost, Cost price), lead_days (Lead time, Lead time days), review_days, safety_days, moq, pack (Pack size, Order multiple), supplier, owner, currency, stock_asof, history_start and history_through. These are supported aliases, not a promise that Netstock exports those fields in every report. Canonical underscore field names also work. No quantity or cost is inferred from Value, Days on hand or Model value. Missing inputs stay empty and block buying. Default currency is NZD; set the actual currency from your source before using values.

The complete file is atomic, including --dry-run, which validates and rolls back. Repeated identical rows do not change stock records. A changed existing row fails unless --update is supplied; inspect the changes first. Duplicate item/location rows, invalid numbers and dates fail the whole import. Existing fields absent from a changed report are preserved. Empty values do not erase a prior field. Use update --field=null with evidence to clear an optional field.

A stock report does not contain complete sales history, purchase-order history, existing forecasts or attachments. Export 90 complete days of demand from your source business system, normalize to one daily total per SKU/location, and import:

```bash
npm run planning -- import demand --file=imports/demand.csv --actor="Your name" --dry-run
npm run planning -- import demand --file=imports/demand.csv --actor="Your name"
```

Demand headers: SKU, Location, Date (YYYY-MM-DD), Units. Import is idempotent; changed daily totals require --update. Negative returns must be reconciled before import. Set coverage dates only after confirming omitted days mean zero demand. Record open purchase orders with order using their external references, due dates, quantities and evidence. Reconcile stock, totals by currency, open orders and source values. Run attention, forecast and buy-plan. Test a known product manually before using recommendations.

The one-command stock import starts the switch in a day. It is not a complete one-click transfer of every Netstock feature. Enterprise DNA handles the agreed mapping, demand and order feeds, reconciliation and custom rules. Scheduled connections and supplier sending require separately scoped work. Use export for JSON copies of all seven data sets; preserve the original source files and database backups too.
