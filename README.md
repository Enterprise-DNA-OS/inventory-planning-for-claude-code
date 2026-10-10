# Inventory Planning for Claude Code

See what to buy, what will run short and which supplier needs a follow-up. Stock, demand, purchasing decisions and review evidence live in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and run the demo. | Your planning rules, Netstock exports, reports and connections. | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=netstock) · [Instead of Netstock](https://enterprisedna.co/omni/instead-of/netstock)

## Quick start

Node 20 or later. No separate database installation required.

```bash
git clone https://github.com/Enterprise-DNA-OS/inventory-planning-for-claude-code.git
cd inventory-planning-for-claude-code
npm install
npm run demo
npm run planning -- weekly-review
npm run docs
npm run view
```

Open this folder in Claude Code, Codex, OpenCode or Cursor. AGENTS.md points to the same operating rules as CLAUDE.md. Local PGlite is the default. DATABASE_URL selects PostgreSQL with a trusted operator role. This is not a multi-tenant application. Never seed a shared database.

The fictional demo contains Auckland and Christchurch glove and packaging stock: one purchase suggestion, excess stock, a stale snapshot, missing policies, an expired promotion, a late purchase order and an overdue review. Dates are relative to today. Seed runs preserve existing rows.

## The weekly rituals

Start Monday with /buy-plan, /attention and /supplier-review, then /weekly-review. Check /shortages and /late-orders before buying. Review /excess and /backtest with the sales forecast. /log records follow-ups, /resolve records the evidence, /override sets a dated demand assumption, and /draft-order prepares a request without sending it.

28 CLI commands and 32 slash-command recipes. All CLI commands accept --json. Read the recipe in .claude/commands or run help. SKU@Location, case-insensitive unique names and partial UUIDs work. Ambiguous matches list choices and exit with failure. All mutations require an actor. Order, receipt, update and demand records also require evidence.

- /help: help
- /list: list
- /show: show --ref="SKU@Location"
- /buy-plan: buy-plan
- /shortages: shortages
- /excess: excess
- /forecast: forecast
- /backtest: backtest
- /supplier-review: supplier-review
- /late-orders: late-orders
- /attention: attention
- /reviews: reviews
- /compliance: compliance
- /activity: activity
- /weekly-review: weekly-review
- /scenario: scenario --demand-percent=20 --extra-lead=7
- /add: add --sku="CODE" --location="Location" --name="Description" --actor="Operator"
- /update: update --ref="SKU@Location" --owner="Planner" --actor="Operator" --evidence="Source reference"
- /log: log --ref="SKU@Location" --note="Follow-up needed" --due=YYYY-MM-DD --actor="Operator"
- /resolve: resolve --review="review-id" --actor="Operator" --evidence="Resolution source"
- /override: override --ref="SKU@Location" --daily=10 --until=YYYY-MM-DD --reason="Promotion evidence" --actor="Operator"
- /order: order --ref="SKU@Location" --reference="PO-123" --units=100 --due=YYYY-MM-DD --evidence="Approved order reference" --actor="Operator"
- /receive: receive --ref="SKU@Location" --reference="PO-123" --units=20 --evidence="Delivery docket" --actor="Operator"
- /demand: demand --ref="SKU@Location" --date=YYYY-MM-DD --units=5 --evidence="Daily ERP total" --actor="Operator"
- /import: import netstock --file="imports/stock.csv" --location="Location" --actor="Operator" --dry-run
- /export: export
- /draft-order: draft-order --ref="SKU@Location"
- /draft-review: draft-review
- /docs, /view, /customise and /new-view: branded paperwork, snapshots and tested customisation.

## Know what drives the order

The baseline uses 90 complete days of demand, including zero-sale days. A dated override replaces that mean. Lead time, review interval and safety days set the target. Allocations reduce stock availability; due open orders reduce the shortfall. Minimum quantities and pack sizes set the final suggestion. Missing data or stale stock blocks buying. The scenario command changes assumptions without saving them. See [the method and limits](docs/planning-method.md).

This is a replenishment planning base for distributors, not a claim to reproduce Netstock's forecasting algorithms, capacity planning or integrations. A human reviews every purchase suggestion. Receipts record goods already received and update on-hand stock; never replay them or double-count them with a refreshed stock snapshot. Demand entries are daily totals, not additive transactions.

## Ten questions this build answers

These are working examples, not unsupported claims that Netstock cannot answer them.

1. Which products need buying after packs and minimum quantities are applied? Run `buy-plan`.
2. Which stock will run out before normal lead time? Run `shortages`.
3. Where is excess stock tied up, separately for each currency? Run `excess`.
4. Which suggestions are blocked by stale or incomplete records? Run `attention`.
5. Which supplier orders are overdue and how much is still outstanding? Run `late-orders`.
6. How much are we proposing to buy from each supplier? Run `supplier-review`.
7. Which forecasts use an override and when does it expire? Run `forecast`.
8. How far was the prior demand average from the latest month? Run `backtest`.
9. What changes if demand doubles and lead time increases? Run `scenario --demand-percent=100 --extra-lead=7`.
10. Who changed our planning records and what was recorded before? Run `activity`.

## Bring your records

```bash
npm run planning -- import netstock --file=imports/stock.csv --location=Auckland --actor="Your name" --dry-run
npm run planning -- import netstock --file=imports/stock.csv --location=Auckland --actor="Your name"
```

The importer preserves every original column and validates the whole file before committing. Changed existing rows require --update. Netstock's documented stock-holding export is not complete demand or purchase-order history: those records need separate source data. [Export steps and mapping](docs/replace-netstock.md). Do not infer quantities from stock values.

## Documents, views and record checks

Change brand.json once. npm run docs produces draft purchase requests and stock review records; npm run view produces weekly, forecast and controls snapshots. Outputs stay outside version control. Print HTML to PDF after reviewing it. /compliance checks record completeness and internal controls. [Sources and limits](docs/compliance.md). The history is an operational audit trail, not immutable evidence. [What a screen adds](docs/why-no-front-end.md).

## Your first hour: ten things to ask for

1. Put our company name and logo on the purchase request.
2. Test our stock report import without saving it.
3. Map the exact names of our exported columns.
4. Add our stock quantities and source dates.
5. Import daily demand and confirm the coverage window.
6. Add our minimum orders and carton sizes.
7. Show stock that will run short before delivery.
8. Compare the plan with a longer lead time.
9. Record a promotion with an expiry date.
10. Prepare the Monday supplier review.

/customise writes a migration and tests the requested rule. /new-view adds a read-only report. There is no application front end.

## Price context

Netstock's public starting price is $900 per month, equivalent to $10,800 over twelve months. Its page does not specify the currency. This is a public-rate calculation, not a customer invoice or a promise about your quote. [Vendor pricing](https://www.netstock.com/request-pricing/), checked 10 October 2026. [Selection evidence and scores](docs/research.md).

## Verification

npm test uses an isolated temporary database and exercises all 28 CLI commands, arithmetic, blocked records, forecast overrides, receipts, import rollback and idempotency, source retention, exports, draft files and escaped HTML. CI defines Node 20/22 on Linux and Windows and a PostgreSQL 17 job. A CI definition alone does not prove a passing run. TEST_DATABASE_URL must name an empty disposable database.

## Built and run for you

Enterprise DNA brings across the agreed exports, reconciles records, builds your rules, and adds a web front end or a different stack when agreed. Omni by Enterprise DNA runs it for one setup fee, then a retainer. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=netstock).

MIT. Not affiliated with Netstock or Anthropic. Hosting and agent usage have their own costs.
