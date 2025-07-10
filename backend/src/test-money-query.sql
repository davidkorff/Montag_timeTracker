-- Query to see money calculation for time entries
SELECT 
    te.id as time_entry_id,
    te.date,
    te.hours,
    te.description,
    p.name as project_name,
    c.name as client_name,
    c.billing_rate,
    c.default_rate,
    COALESCE(c.billing_rate, c.default_rate, 175) as effective_rate,
    te.hours * COALESCE(c.billing_rate, c.default_rate, 175) as calculated_money,
    te.invoice_id,
    i.invoice_number
FROM time_entries te
JOIN projects p ON te.project_id = p.id
JOIN clients c ON p.client_id = c.id
LEFT JOIN invoices i ON te.invoice_id = i.id
WHERE te.is_billable = true
ORDER BY te.date DESC
LIMIT 20;