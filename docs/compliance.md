# Record checks and sources

The compliance command checks records, not legal compliance or forecast accuracy. This version uses New Zealand inventory record requirements as its starting point. Australian and other jurisdiction rules require a scoped review before adoption.

| Rule | What the command checks | Source and limit |
|---|---|---|
| NZ-STOCK | Active items have quantity, unit cost and a stock date | [IRD trading stock](https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-income/trading-stock) requires year-end stock valuation and good records. Completeness is a reminder, not an approved valuation method. |
| CONTROL-OWNER | An active item has a named planner | Internal operating policy; not legislation. |
| CONTROL-COVERAGE | Complete demand window is confirmed through yesterday | Internal forecast input policy; not legislation. |
| CONTROL-FRESHNESS | Stock snapshot is within seven days and not future dated | Internal demo policy; customise to your operation. |

[IRD record keeping](https://www.ird.govt.nz/managing-my-tax/record-keeping), checked 10 October 2026, calls for records to be kept for at least seven tax years, language requirements and approval where records are stored offshore. This tool has no delete command and provides JSON exports and change history. It cannot verify retention periods, backup durability, offshore approval or completeness of accounting records. Keep original exports and source documents; have the operator establish retention and restore checks. An administrator can still alter records.

Purchase requests and stock reviews are draft operational documents. The system does not file tax returns, calculate tax, execute payments, prescribe a statutory stock valuation method or certify service levels.
