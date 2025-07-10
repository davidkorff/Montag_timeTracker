const generateInvoiceNumber = async (client) => {
  // Get the current year
  const currentYear = new Date().getFullYear();
  
  // Find the last invoice number for this year
  const result = await client.query(
    `SELECT invoice_number 
     FROM invoices 
     WHERE invoice_number LIKE $1 
     ORDER BY invoice_number DESC 
     LIMIT 1`,
    [`${currentYear}-%`]
  );
  
  let nextNumber = 1;
  
  if (result.rows.length > 0) {
    const lastInvoiceNumber = result.rows[0].invoice_number;
    const lastNumber = parseInt(lastInvoiceNumber.split('-')[1]);
    nextNumber = lastNumber + 1;
  }
  
  // Format: YYYY-NNNN (e.g., 2025-0001)
  return `${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
};

module.exports = {
  generateInvoiceNumber
};