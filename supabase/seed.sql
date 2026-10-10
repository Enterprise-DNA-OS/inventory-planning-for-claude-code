INSERT INTO positions(id,sku,location,name,supplier,owner,on_hand,allocated,unit_cost,lead_days,review_days,safety_days,moq,pack,stock_asof,history_start,history_through)
VALUES
('10000000-0000-4000-8000-000000000001','GLV-100','Auckland','Nitrile glove carton','Pacific Supplies','Aroha',50,10,20,20,7,5,100,20,current_date,current_date-90,current_date-1),
('10000000-0000-4000-8000-000000000002','GLV-200','Auckland','Heavy duty glove carton','Pacific Supplies','Aroha',600,0,35,14,7,5,40,10,current_date,current_date-90,current_date-1),
('10000000-0000-4000-8000-000000000003','TAP-010','Christchurch','Packing tape carton','South Coast Packaging','Ben',12,2,15,30,7,7,20,5,current_date-10,current_date-90,current_date-1),
('10000000-0000-4000-8000-000000000004','GLV-100','Christchurch','Nitrile glove carton','Pacific Supplies','Ben',300,0,20,20,7,5,100,20,current_date,current_date-90,current_date-1),
('10000000-0000-4000-8000-000000000005','NEW-001','Auckland','New sleeve carton',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO demand(position_id,day,units,source_ref)
SELECT p.id,current_date-n,CASE WHEN p.sku='GLV-100' AND p.location='Auckland' THEN 5 WHEN p.sku='GLV-200' THEN 1 WHEN p.sku='TAP-010' THEN 2 ELSE 0 END,'fictional-demo'
FROM positions p CROSS JOIN generate_series(1,90) n WHERE p.id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') ON CONFLICT DO NOTHING;
INSERT INTO orders(id,reference,position_id,units,due,evidence) VALUES
('20000000-0000-4000-8000-000000000001','PO-DEMO-01','10000000-0000-4000-8000-000000000001',20,current_date-3,'fictional supplier acknowledgement'),
('20000000-0000-4000-8000-000000000002','PO-DEMO-02','10000000-0000-4000-8000-000000000002',100,current_date+90,'fictional forward order') ON CONFLICT DO NOTHING;
INSERT INTO reviews(id,position_id,note,actor,due) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Confirm delayed vessel and availability','Aroha',current_date-2) ON CONFLICT DO NOTHING;
INSERT INTO overrides(id,position_id,daily_units,valid_until,reason,actor) VALUES ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',3,current_date-1,'Expired spring promotion','Aroha') ON CONFLICT DO NOTHING;
