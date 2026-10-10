# Import

Read CLAUDE.md. Run `npm run planning -- import netstock --file="imports/stock.csv" --location="Location" --actor="Operator" --dry-run` with the operator's supplied values. Add `--json` when collecting results. Resolve names with `list`; ambiguous references must be clarified with the operator. Never invent an actor, evidence, date or result.

Present the result, the stock date and any blocked inputs. Label all order suggestions and documents as drafts. Never send, place an order, change a supplier system or delete records.

Read docs/replace-netstock.md. Inspect the real headers. Keep the original export private. Run the dry run, reconcile row counts and values, then repeat without --dry-run when the operator requests the import. Demand history needs the separate documented import and explicit coverage dates.
