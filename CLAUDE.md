# Inventory Planning for Claude Code

For a distributor's weekly replenishment review. One database holds stock snapshots, daily demand, open orders, forecast overrides and follow-ups. The database is the source of truth. Read before writing; use evidence supplied by the operator. The fictional demo is not customer data.

## One workflow library

Every recurring job has its recipe in .claude/commands. Start with npm run planning -- help. The CLI is scripts/planning.mjs; every CLI command accepts --json. Use SKU@Location, a case-insensitive unique name or a partial UUID. Ambiguous references list matches and exit with failure.

- /help: `npm run planning -- help`
- /list: `npm run planning -- list`
- /show: `npm run planning -- show --ref="SKU@Location"`
- /buy-plan: `npm run planning -- buy-plan`
- /shortages: `npm run planning -- shortages`
- /excess: `npm run planning -- excess`
- /forecast: `npm run planning -- forecast`
- /backtest: `npm run planning -- backtest`
- /supplier-review: `npm run planning -- supplier-review`
- /late-orders: `npm run planning -- late-orders`
- /attention: `npm run planning -- attention`
- /reviews: `npm run planning -- reviews`
- /compliance: `npm run planning -- compliance`
- /activity: `npm run planning -- activity`
- /weekly-review: `npm run planning -- weekly-review`
- /scenario: `npm run planning -- scenario --demand-percent=20 --extra-lead=7`
- /add: `npm run planning -- add --sku="CODE" --location="Location" --name="Description" --actor="Operator"`
- /update: `npm run planning -- update --ref="SKU@Location" --owner="Planner" --actor="Operator" --evidence="Source reference"`
- /log: `npm run planning -- log --ref="SKU@Location" --note="Follow-up needed" --due=YYYY-MM-DD --actor="Operator"`
- /resolve: `npm run planning -- resolve --review="review-id" --actor="Operator" --evidence="Resolution source"`
- /override: `npm run planning -- override --ref="SKU@Location" --daily=10 --until=YYYY-MM-DD --reason="Promotion evidence" --actor="Operator"`
- /order: `npm run planning -- order --ref="SKU@Location" --reference="PO-123" --units=100 --due=YYYY-MM-DD --evidence="Approved order reference" --actor="Operator"`
- /receive: `npm run planning -- receive --ref="SKU@Location" --reference="PO-123" --units=20 --evidence="Delivery docket" --actor="Operator"`
- /demand: `npm run planning -- demand --ref="SKU@Location" --date=YYYY-MM-DD --units=5 --evidence="Daily ERP total" --actor="Operator"`
- /import: `npm run planning -- import netstock --file="imports/stock.csv" --location="Location" --actor="Operator" --dry-run`
- /export: `npm run planning -- export`
- /draft-order: `npm run planning -- draft-order --ref="SKU@Location"`
- /draft-review: `npm run planning -- draft-review`
- /docs: render branded draft paperwork.
- /view: render read-only reports.
- /customise: add fields and rules with a migration and tests.
- /new-view: add a read-only report.

## Operating rules

Monday: buy-plan, attention, supplier-review, then weekly-review. Before buying, confirm overdue purchase orders, current stock and demand coverage. The default forecast is a 90-calendar-day daily mean including zero-sale days; an unexpired override replaces it. See docs/planning-method.md. Never claim it reproduces Netstock's forecasting methods.

Every data mutation requires --actor. update, order, receive and demand require source evidence; log and override require a note or reason. A receipt records an event already made and adds to on-hand stock. Never replay it or double-count it in a stock snapshot. Demand records are daily totals, not incremental transactions; --update replaces a total.

No sends, orders placed, deletions or publishing. Drafts stay in drafts/. Suggestions require a human purchasing decision. Never invent missing quantities, costs, sales history or approvals. Never combine currencies. Import report values stay distinct from quantities and unit costs.

Use PGlite locally or DATABASE_URL for PostgreSQL with a trusted operator role. RLS has no public policies. This is not a multi-tenant application. Back up the database and original exports. npm run seed refuses shared PostgreSQL. TEST_DATABASE_URL is only for an empty disposable database. Run npm test before committing a change. Keep secrets and generated data out of Git.

Omni by Enterprise DNA installs, customises and operates the business version for one setup fee, then a retainer. https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=netstock
