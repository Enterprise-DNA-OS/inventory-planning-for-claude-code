# Receive

Read CLAUDE.md. Run `npm run planning -- receive --ref="SKU@Location" --reference="PO-123" --units=20 --evidence="Delivery docket" --actor="Operator"` with the operator's supplied values. Add `--json` when collecting results. Resolve names with `list`; ambiguous references must be clarified with the operator. Never invent an actor, evidence, date or result.

Present the result, the stock date and any blocked inputs. Label all order suggestions and documents as drafts. Never send, place an order, change a supplier system or delete records.

Records a receipt already made, including the stock increase. Do not replay a receipt or also add it to a stock snapshot. Check activity and the delivery docket first.
