# What the numbers mean

The planning unit is a SKU at one location. Demand is the 90 complete calendar days before today, divided by 90, including days with no demand row. Confirm history_start at least 90 days ago and history_through equal to yesterday only after reconciling the source. A later valid override replaces the mean until its expiry date. Missing demand rows count as zero only inside this operator-confirmed window. Returns must be reconciled upstream; negative daily demand is rejected.

Available stock is on_hand minus allocated, including negative availability for backorders. Target quantity is the daily rate times lead days plus review days plus safety days, rounded up. Open outstanding purchase orders due by lead days plus review days count as inbound, including late orders. Confirm those late deliveries during attention review. Later orders do not reduce today's recommendation.

Buy quantity is target minus available minus inbound. When positive it rises to the minimum order quantity, then rounds up to the pack multiple. Otherwise it is zero. Cost is suggested quantity times unit cost; this excludes freight, duty and tax. Never add different currencies together. days_cover is available divided by demand; it is blank for zero demand. Excess is available plus qualifying inbound minus target, floored at zero.

Missing policies, supplier, owner, quantities or unit cost block a buy suggestion. So does a stock snapshot more than seven days old or in the future, or incomplete demand coverage. Seven days is a demo policy, not a statutory rule. A new item remains blocked until its source data is complete; /customise can define a reviewed new-item policy.

backtest compares the first 60 days' mean projected over 30 days with the actual latest 30-day total. Its error is the absolute difference in units. It is a period check, not WAPE, a service-level prediction or proof of accuracy. scenario changes demand and lead time without saving records. The default has no seasonality detection, probabilistic forecasting, capacity planning, multi-level material planning or automated supplier connection.

Order and receipt commands record existing external decisions. They never place or send an order. Partial receipts update the outstanding quantity and on-hand stock together, in one transaction. The stock snapshot's original date stays unchanged so a receipt cannot make an old full snapshot appear fresh. Records and history can be edited by a database administrator; this is not an immutable ledger.
