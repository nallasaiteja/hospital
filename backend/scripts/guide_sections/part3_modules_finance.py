# -*- coding: utf-8 -*-
"""Part 3: Deep-Dive Module-by-Module Guide (Financial Management Modules)"""

def get_part3_finance():
    return """# PART 3: Deep-Dive Module-by-Module Guide (Part 3: Financial Management)

---

## 3.16 Module 15: Central Pricing & Tariff Management (`/staff/pricing-tariffs`)

### 1. Module Name & Route
- **Displayed Name:** Hospital Pricing & Tariff Management
- **Frontend Route:** `/staff/pricing-tariffs`

### 2. Simple Explanation
The master price list of the entire hospital. It sets how much the hospital charges for doctor consultations, daily bed rent, ICU stay, blood tests, X-rays, and surgeries, and allows hospital directors to update prices across all branches with 1 click.

### 3. Real Hospital Example
The Hospital Board decides to increase General OPD Consultation fees from ₹500 to ₹600. The Hospital Administrator opens this screen, edits the rate, reviews the revenue impact preview, and clicks "Apply Central Tariffs". Instantly, every branch receptionist sees the new ₹600 fee.

### 4. Who Uses It?
Hospital Admins, Super Admins, Chief Financial Officers, Billing Directors.

### 5. Why Does This Module Exist?
Prevents branches from arbitrarily charging different prices, guarantees transparent patient billing, and models financial revenue changes before prices go live.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Billable Services (e.g. 420 services), Consultation Tariffs, Bed & Room Rates, Diagnostics Catalog.
- **Service Rate Table:** Service Code, Category, Description, Base Rate (₹), GST %, Effective Date, Action Buttons.
- **Impact Analysis Preview:** Shows projected annual revenue impact (+₹14.2 Lakhs) before confirming price changes.
- **Branch Propagation Drawer:** Confirms synchronization across Downtown, City Center, and West Wing branches.

### 7. Every Tab Explained
- *Consultation Tariffs Tab:* Specialist, General, and Super-Specialist OPD fees.
- *Bed & Ward Rates Tab:* Daily room rents for General, Deluxe, and ICU beds.
- *Clinical Services Tab:* Lab tests, radiology scans, physiotherapy, and nursing procedures.
- *Corporate & Insurance Tiers Tab:* Contracted tariff discounts for specific insurance TPAs.

### 8. Every Button Explained
1. **"Edit Service Rate" (`Edit`):** Updates base price or GST tax percentage.
2. **"Review Impact Analysis" (`TrendingUp`):** Models financial projection of price adjustment.
3. **"Apply Central Tariffs" (`Globe`):** Pushes updated price schedule to all branches simultaneously.
4. **"Add New Billable Service" (`Plus`):** Creates a brand new service code.

### 9. Complete Workflow
1. Admin selects a service (e.g. "ECG Test").
2. Changes rate from ₹350 to ₹400.
3. Clicks "Preview Impact". System calculates projected annual revenue increase.
4. Clicks "Apply Central Tariffs".
5. New rate is active across all appointment and billing forms.

### 10. Data Entry Explanation
- *Service Code:* Unique code (e.g. `BED-ICU-01`, `LAB-CBC-01`, `OPD-DOC-GEN`).
- *Base Rate:* Pre-tax charge in Indian Rupees (₹).
- *GST Rate:* 0% for medical services; 12%/18% for specialized cosmetic/medical devices.

### 11. Status Explanation
- `DRAFT`: Price revision under executive review.
- `ACTIVE`: Live rate charged to patients.
- `ARCHIVED`: Historical rate preserved for past audit trails.

### 12. Database Explanation
- Stored in: `billing_tariffitem`, `billing_tariffrevision`, `billing_tariffimpactlog`.

### 13. Module Connections
- Feeds live rates into OPD Appointments, IPD Running Bills, Cashier Desk, and Invoicing.

### 14. Permissions
- Restricted to SUPER_ADMIN, HOSPITAL_ADMIN, and FINANCE_MANAGER.

### 15. Error Handling
- Prohibits setting negative rates or setting effective dates in the past.

### 16. Practical Examples
- Adding a new "Robotic Knee Surgery" procedure tariff with OT and implant package costs.
- Adjusting Deluxe room rent from ₹4,500 to ₹5,000 for the new fiscal year.

### 17. Important Things to Remember
- Changing a tariff never alters past paid bills or ongoing active inpatient admissions contracted at previous rates!

---

## 3.17 Module 16: Billing, Invoicing & Cashier Desk (`/staff/billing`)

### 1. Module Name & Route
- **Displayed Name:** 12. Billing & Cashier
- **Frontend Route:** `/staff/billing`

### 2. Simple Explanation
The hospital cash counter and checkout desk. It brings together all patient charges—consultations, room rent, blood tests, X-rays, and medicines—subtracts any advance deposits already paid, accepts final payments via Cash, Card, or UPI, and prints official tax invoices.

### 3. Real Hospital Example
Rahul is getting discharged after 4 days. The billing executive clicks Rahul's MRN: the system aggregates 4 days bed rent (₹6,000), doctor visits (₹2,400), lab tests (₹1,800), and medicines (₹2,200). Total: ₹12,400. The system automatically deducts his ₹5,000 advance deposit. Rahul pays the remaining ₹7,400 via UPI, and receives a printed zero-balance tax invoice.

### 4. Who Uses It?
Billing Executives, Cashiers, Finance Officers, Hospital Administrators.

### 5. Why Does This Module Exist?
Prevents billing leakage (forgetting to charge for a medicine or test), guarantees accurate cash drawer tracking, and prints GST-compliant tax invoices.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Today's Total Collections, Outstanding Inpatient Balances, Bills Awaiting Discharge Settlement, Cashier Drawer Balance.
- **Inpatient Billing Folio:** Chronological line-item ledger of every single charge accrued during hospital stay.
- **Payment Collection Modal:** Split payment inputs (Cash, Credit Card, UPI, Cheque, TPA Insurance).
- **Cashier Drawer Panel:** Opening float, current cash count, expected cash, and shift reconciliation.

### 7. Every Tab Explained
- *Active Inpatient Folios Tab:* Running bills for patients currently in hospital beds.
- *Outpatient Billing Tab:* Walk-in billing for lab tests, radiology scans, and day procedures.
- *Cash Drawer & Shifts Tab:* Daily cash intake, opening floats, and handover audits.
- *Refunds & Reversals Tab:* Audited credit notes and patient refunds.

### 8. Every Button Explained
1. **"Generate Final Bill" (`FileSpreadsheet`):** Combines all departmental charges into an invoice.
2. **"Collect Payment" (`DollarSign`):** Accepts Cash, Card, or UPI and posts financial receipt.
3. **"Apply Approved Discount" (`Percent`):** Applies discount with mandatory administrative reason.
4. **"Print Tax Invoice" (`Printer`):** Generates official GST-compliant Tax Invoice PDF.

### 9. Complete Workflow
1. Patient ready for discharge -> Billing Executive opens patient folio.
2. Reviews itemized charges -> Verifies pharmacy and lab charges.
3. System applies advance deposits -> Calculates net balance due.
4. Cashier collects payment via Cash/Card/UPI -> Clicks "Settle".
5. Prints Final Tax Invoice -> Gives financial clearance for patient discharge.

### 10. Data Entry Explanation
- *Payment Mode:* Cash, Credit/Debit Card, UPI QR Code, Net Banking, TPA Cashless.
- *Reference Number:* UPI transaction UTR number or Card approval authorization code.

### 11. Status Explanation
- `DRAFT`: Bill accruing ongoing daily charges.
- `PENDING_SETTLEMENT`: Patient discharged, awaiting balance payment.
- `PAID`: Fully settled with zero outstanding balance.
- `REFUNDED`: Excess deposit returned to patient.

### 12. Database Explanation
- Stored in: `billing_invoice`, `billing_invoicelineitem`, `billing_paymenttransaction`, `billing_cashiershift`.

### 13. Module Connections
- Automatically pulls charges from Beds, Nursing MAR, Pharmacy, LIS, and RIS; posts revenue to General Ledger.

### 14. Permissions
- Billing Executives generate invoices; Cashiers collect cash; Admins authorize discounts.

### 15. Error Handling
- System blocks patient discharge if an invoice has an unsettled outstanding balance.

### 16. Practical Examples
- Inpatient deposited ₹10,000 advance; total bill is ₹8,200; cashier issues ₹1,800 cash refund on discharge.
- Patient pays ₹20,000 bill using ₹10,000 Cash and ₹10,000 Credit Card via Split Payment.

### 17. Important Things to Remember
- Always enter the UPI reference UTR number into the system to ensure 100% bank reconciliation accuracy!

---

## 3.18 Module 17: Insurance & Corporate TPA Claims (`/staff/insurance`)

### 1. Module Name & Route
- **Displayed Name:** 13. Insurance & TPA Claims
- **Frontend Route:** `/staff/insurance`

### 2. Simple Explanation
The cashless health insurance and Mediclaim desk. When patients have health insurance (like Star Health, HDFC ERGO, Medi Assist), this module sends pre-authorization requests to the insurance company, answers medical questions, and files claims so the insurer pays the hospital directly.

### 3. Real Hospital Example
A patient with severe appendicitis holds a Star Health insurance policy. The TPA Coordinator enters the policy number, uploads the doctor's diagnosis, and receives a ₹60,000 cashless approval within 45 minutes. The patient is admitted without paying large out-of-pocket cash.

### 4. Who Uses It?
Insurance Desk Executives, Billing Staff, Finance Officers, Medical Records Officers.

### 5. Why Does This Module Exist?
Ensures the hospital gets paid by insurance companies on time and minimizes out-of-pocket cash stress for patients during medical emergencies.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Pre-Auth Requests Under Review, Approved Cashless Volume (₹), Insurer Queries Pending Response, Settled Claims Received.
- **Claims Worklist Table:** Claim ID, Patient Name, Insurer / TPA, Policy #, Pre-Auth Approved Amount, Final Bill Amount, Claim Status, Actions.
- **Pre-Authorization Submission Modal:** Form to attach diagnostic reports, estimated cost sheet, and doctor admission advice.
- **Insurer Query Tracker:** Chat/query interface to resolve insurance medical queries quickly.

### 7. Every Tab Explained
- *Pre-Authorization Tab:* Initial admission approval requests.
- *Active Hospitalizations Tab:* Admitted cashless patients tracking limit enhancements.
- *Post-Discharge Claims Tab:* Compiling bills, lab reports, and discharge summaries for submission.
- *Payment Settlements Tab:* Reconciling insurer bank payments and co-pay deductions.

### 8. Every Button Explained
1. **"Submit Pre-Auth Request" (`Send`):** Sends admission packet to insurance company.
2. **"Request Enhancement" (`TrendingUp`):** Requests higher approved amount for complex surgeries.
3. **"Upload Claim Docket" (`UploadCloud`):** Uploads compiled digital medical documents.
4. **"Reconcile Settlement" (`CheckCircle`):** Records insurer bank settlement voucher.

### 9. Complete Workflow
1. Patient arrives with health insurance card.
2. Coordinator submits pre-authorization request with estimated charges.
3. Insurer sends initial approval sanction letter (e.g. ₹50,000).
4. Patient admitted; if surgery is performed, coordinator requests limit enhancement.
5. On discharge: Coordinator uploads final bill and discharge summary.
6. Insurer approves final claim -> Transfers payment to hospital bank account within 30 days.

### 10. Data Entry Explanation
- *TPA Name:* Medi Assist, Vidal Health, Star Health, Paramount, etc.
- *Policy Number & UHID:* Insurer policy identification numbers.
- *Approved Cashless Limit:* Maximum amount insurer will pay directly.

### 11. Status Explanation
- `PRE_AUTH_PENDING`: Awaiting insurance initial decision.
- `APPROVED`: Cashless approved; hospital can proceed.
- `QUERY_RAISED`: Insurer requires additional clinical information.
- `CLAIM_SUBMITTED`: Final bills submitted after discharge.
- `SETTLED`: Payment received in hospital bank account.

### 12. Database Explanation
- Stored in: `billing_insuranceclaim`, `billing_tpacompany`, `billing_claimdocketattachment`.

### 13. Module Connections
- Links to Inpatient Admissions, Doctor EMR (for discharge summaries), and Billing Desk.

### 14. Permissions
- Insurance coordinators manage claims; Finance officers reconcile settled bank vouchers.

### 15. Error Handling
- Alerts coordinator if an insurance query has been pending for over 2 hours during discharge.

### 16. Practical Examples
- Pre-auth approved for ₹40,000; final bill is ₹46,000; coordinator requests ₹6,000 enhancement; insurer approves ₹5,000; patient pays ₹1,000 non-payable co-pay.
- Insurer requests histology report; coordinator attaches verified pathology report from LIS in 1 minute.

### 17. Important Things to Remember
- Always secure a signed cashless authorization letter from the insurer before patient discharge!

---

## 3.19 Module 18: Chart of Financial Accounts (`/staff/financial-accounts`)

### 1. Module Name & Route
- **Displayed Name:** 14. Financial Accounts
- **Frontend Route:** `/staff/financial-accounts`

### 2. Simple Explanation
The master tree structure of all hospital financial categories. It organizes everything the hospital owns (Assets), everything the hospital owes (Liabilities), all money coming in (Revenue), and all money spent (Expenses) into standard accounting codes.

### 3. Real Hospital Example
The Senior Accountant wants to track pharmacy revenue separately from laboratory revenue. In the Chart of Accounts, she finds `Account 4100 - Pharmacy Sales` and `Account 4200 - Laboratory Revenue`. Every time a medicine is sold, the money automatically flows into Account 4100.

### 4. Who Uses It?
Chief Financial Officers, Senior Accountants, Auditors.

### 5. Why Does This Module Exist?
Without a structured Chart of Accounts, hospital money is chaotic. It ensures standard accounting principles (GAAP / Ind-AS) so financial statements can be officially audited.

### 6. Complete Screen Explanation
- **Hierarchical Account Tree:** Collapsible tree view showing the 5 master financial categories:
  - 1000: **Assets** (Cash, Bank Accounts, Medical Equipment, Pharmacy Inventory).
  - 2000: **Liabilities** (Vendor Payables, Bank Loans, Patient Advance Deposits).
  - 3000: **Equity / Capital** (Hospital Owner Capital, Retained Surplus).
  - 4000: **Revenue** (OPD Consultations, Bed Rent, Surgery Fees, Lab Charges).
  - 5000: **Expenses** (Staff Salaries, Medicine Purchases, Electricity, Equipment AMC).
- **Account Detail Drawer:** Current Balance (₹), Normal Balance (Debit/Credit), Parent Category, Tax Code.

### 7. Every Tab Explained
- *Account Tree Tab:* Visual nested directory of all financial accounts.
- *Account List Tab:* Searchable, filterable tabular list with current balances.
- *Sub-Ledgers Tab:* Specialized subsidiary ledgers for Vendors and Patients.

### 8. Every Button Explained
1. **"Add Ledger Account" (`Plus`):** Creates a new sub-account under Assets, Liabilities, or Expenses.
2. **"View Account Ledger" (`BookOpen`):** Displays all debit and credit transactions posted to this specific account.
3. **"Export Chart of Accounts" (`Download`):** Exports accounting structure as PDF or Excel.

### 9. Complete Workflow
1. Finance Manager creates new expense code: `5240 - Biomedical Waste Disposal`.
2. Sets parent as `5200 - Operating Expenses`.
3. Sets normal balance as `DEBIT`.
4. Accountants can now post waste disposal bills to this code.

### 10. Data Entry Explanation
- *Account Code:* 4-digit code (e.g. `1010 - Cash in Hand`, `1020 - HDFC Bank`).
- *Account Type:* Asset, Liability, Equity, Revenue, Expense.

### 11. Status Explanation
- `ACTIVE`: Active account open for journal entries.
- `INACTIVE`: Retired account preserved for historical reporting.

### 12. Database Explanation
- Stored in: `billing_chartofaccount` (fields: `id`, `code`, `name`, `account_type`, `parent_id`, `current_balance`, `is_active`).

### 13. Module Connections
- Foundation for Financial Transactions, General Ledger, Profit & Loss, and Balance Sheet.

### 14. Permissions
- Modifying accounts is restricted to FINANCE_MANAGER.

### 15. Error Handling
- Blocks deleting any account that has past posted journal entries.

### 16. Practical Examples
- Opening a new bank account at State Bank of India -> Added as `1025 - SBI Operating Account`.
- Creating a separate expense line for "Doctor Medical Conference Subsidies".

### 17. Important Things to Remember
- Assets and Expenses increase with Debits; Liabilities, Equity, and Revenue increase with Credits!

---

## 3.20 Module 19: Financial Transactions & Cashbook (`/staff/transactions`)

### 1. Module Name & Route
- **Displayed Name:** 15. Financial Transactions
- **Frontend Route:** `/staff/transactions`

### 2. Simple Explanation
The hospital cashbook and daily payment register. It records every individual payment received from patients, every check paid to medicine suppliers, petty cash payments for tea and cleaning supplies, and bank transfers.

### 3. Real Hospital Example
The hospital buys 10 boxes of printing paper for ₹3,500 from the local stationery shop using petty cash. The accountant logs a Cash Outflow transaction: "Office Stationery Supplies", attaches the photo of the bill, and hands ₹3,500 cash to the shopkeeper.

### 4. Who Uses It?
Accountants, Cashiers, Finance Managers, Internal Auditors.

### 5. Why Does This Module Exist?
Ensures every physical cash movement or bank transfer has a supporting receipt, timestamp, and authorized reason code to prevent embezzlement.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Cash Inflows Today, Total Outflows Today, Net Cash Balance, Unreconciled Transactions.
- **Transaction Register Table:** Transaction ID, Date/Time, Reference #, Type (INCOME / EXPENSE / TRANSFER), Account, Amount (₹), Paid To / Received From, Status, Actions.
- **Transaction Entry Modal:** Category selector, Payment Mode, Amount, Vendor/Patient Name, Tax Invoice Attachment, Narration.

### 7. Every Tab Explained
- *All Transactions Tab:* Complete searchable cashbook register.
- *Cash Inflows Tab:* Patient collections and miscellaneous revenue.
- *Cash Outflows Tab:* Vendor payments, utility bills, and staff travel expenses.
- *Contra / Transfers Tab:* Transferring money between Cash Drawer and Bank Account.

### 8. Every Button Explained
1. **"Record New Transaction" (`PlusCircle`):** Opens payment/receipt entry modal.
2. **"Attach Payment Receipt" (`Paperclip`):** Uploads scanned invoice or payment voucher.
3. **"Export Cashbook" (`Download`):** Downloads daily cashbook as CSV/PDF.

### 9. Complete Workflow
1. Accountant clicks "Record New Transaction".
2. Selects Type (Expense), Account (Electricity Expense), Payment Mode (Bank Transfer).
3. Enters Amount (₹45,000) and Narration ("Electricity bill for West Wing clinic").
4. Clicks "Save Transaction". General Ledger updates automatically.

### 10. Data Entry Explanation
- *Transaction Type:* Inflow (Income), Outflow (Expense), Transfer (Contra).
- *Narration:* Required clear sentence explaining the business reason for the payment.

### 11. Status Explanation
- `RECORDED`: Logged in daily cashbook.
- `RECONCILED`: Verified against bank statement or physical drawer count.
- `VOIDED`: Cancelled transaction with supervisor audit reason.

### 12. Database Explanation
- Stored in: `billing_financialtransaction` (fields: `id`, `transaction_type`, `amount`, `payment_method`, `account_id`, `reference_number`, `narration`, `created_at`).

### 13. Module Connections
- Feeds into General Ledger, Banking Reconciliation, and Profit & Loss statement.

### 14. Permissions
- Accountants record transactions; Finance Managers approve transactions above ₹25,000.

### 15. Error Handling
- Prohibits saving transactions without selecting an account code or entering a narration.

### 16. Practical Examples
- Depositing ₹1,50,000 daily OPD cash collections into the bank account (Contra Transfer).
- Paying ₹12,000 for emergency air conditioning repair on a weekend.

### 17. Important Things to Remember
- Never hand out hospital cash without getting a signed physical paper voucher from the recipient!

---

## 3.21 Module 20: Hospital Investment Registers (`/staff/investments`)

### 1. Module Name & Route
- **Displayed Name:** 16. Investment Registers
- **Frontend Route:** `/staff/investments`

### 2. Simple Explanation
The hospital savings and fixed deposit portfolio manager. When the hospital has extra money saved up in the bank, this module tracks Fixed Deposits (FDs), government bonds, and mutual funds, calculates annual interest earned, and alerts managers when a deposit matures.

### 3. Real Hospital Example
The hospital sets aside ₹50 Lakhs in a 1-year bank Fixed Deposit at 7.25% interest with HDFC Bank to save for a future MRI machine purchase. The Investment Manager registers the FD here. Every month, the system calculates the ₹30,208 interest earned and adds it to the hospital's financial reports.

### 4. Who Uses It?
Treasury Managers, Chief Financial Officers, Hospital Owners.

### 5. Why Does This Module Exist?
Ensures the hospital earns maximum safe returns on idle funds rather than letting large sums sit in zero-interest checking accounts.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Investment Portfolio (₹), Average Annual Yield %, Accrued Interest Receivable, Investments Maturing in <30 Days.
- **Fixed Deposit Register Table:** Deposit Certificate #, Bank Name, Principal Amount (₹), Interest Rate %, Start Date, Maturity Date, Maturity Value (₹), Status.
- **Maturity Alert Banner:** Notifies management 15 days before an FD matures so they can renew or cash out.

### 7. Every Tab Explained
- *Active Deposits Tab:* Currently earning interest.
- *Maturity Timeline Tab:* Calendar showing which months cash returns will arrive.
- *Liquidated Investments Tab:* Historical records of matured and cashed-out deposits.

### 8. Every Button Explained
1. **"Book New Fixed Deposit" (`Landmark` / `Plus`):** Registers a new bank deposit.
2. **"Calculate Accrued Interest" (`Percent`):** Calculates interest earned up to today.
3. **"Liquidate / Reinvest" (`RefreshCw`):** Closes deposit on maturity and rolls over principal.

### 9. Complete Workflow
1. Treasury transfers ₹25,000,000 surplus to a 12-month FD at 7.5%.
2. Manager logs Certificate #, Bank, Principal, Rate, Maturity Date.
3. Monthly interest automatically posts to General Ledger: Debits `Interest Receivable`, Credits `Interest Income`.
4. On maturity date, manager liquidates FD into main operating bank account.

### 10. Data Entry Explanation
- *Principal Amount:* Deposit investment amount in ₹.
- *Interest Rate:* Annual percentage rate (e.g. 7.25%).
- *Compounding Frequency:* Monthly, Quarterly, or Cumulative at maturity.

### 11. Status Explanation
- `ACTIVE`: Earning interest.
- `MATURING_SOON`: Expiring within 30 days.
- `MATURED`: Term completed, awaiting renewal or cash withdrawal.
- `LIQUIDATED`: Cashed out into operating bank account.

### 12. Database Explanation
- Stored in: `billing_investmentdeposit` (fields: `id`, `certificate_number`, `financial_institution`, `principal_amount`, `interest_rate_pct`, `maturity_date`, `status`).

### 13. Module Connections
- Connects to Cash Flow Forecasting and General Ledger.

### 14. Permissions
- Restricted to INVESTMENT_MANAGER, FINANCE_MANAGER, and SUPER_ADMIN.

### 15. Error Handling
- Validates that maturity date is always in the future relative to deposit date.

### 16. Practical Examples
- Booking a 90-day short-term deposit for temporary surplus funds between salary cycles.
- Reinvesting a matured ₹1 Crore FD into a higher-yielding 3-year infrastructure bond.

### 17. Important Things to Remember
- Track bank TDS (Tax Deducted at Source) certificates to ensure full credit during annual corporate income tax filing!

---

## 3.22 Module 21: Banking & Statement Reconciliation (`/staff/banking`)

### 1. Module Name & Route
- **Displayed Name:** 17. Banking & Reconciliation
- **Frontend Route:** `/staff/banking`

### 2. Simple Explanation
The bank account matcher. It downloads the hospital's official bank statement and matches every bank deposit and check against the hospital's internal computer records. If a check bounced or a bank fee was deducted, this screen finds the difference.

### 3. Real Hospital Example
The hospital bank statement shows a balance of ₹48,20,000, but the computer system says the balance should be ₹48,50,000 (a difference of ₹30,000). The accountant runs the reconciliation: within 10 seconds, the system spots that a ₹30,000 vendor check written yesterday has not yet been deposited by the supplier. Mystery solved!

### 4. Who Uses It?
Senior Accountants, Finance Managers, Auditors.

### 5. Why Does This Module Exist?
Guarantees the hospital's computer books match reality in the bank. Catches unauthorized bank debits, bounced patient checks, and bank service charges.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Book Balance (Hospital System), Bank Balance (Actual Bank), Unreconciled Difference (₹), Matched Transactions %.
- **Dual Reconciliation Screen:**
  - *Left Column:* Hospital Internal Ledger Transactions.
  - *Right Column:* Uploaded Bank Statement Lines.
- **1-Click Auto-Match Engine:** Matches transactions with identical amounts, dates, and check numbers.
- **Discrepancy Resolution Drawer:** Tools to post missing bank fees or investigate unmatched checks.

### 7. Every Tab Explained
- *Reconciliation Workspace Tab:* Active matching screen.
- *Bank Statements Tab:* Uploaded PDF/CSV bank statement files.
- *Reconciliation Reports Tab:* Certified Bank Reconciliation Statements (BRS).

### 8. Every Button Explained
1. **"Upload Bank Statement (CSV)" (`UploadCloud`):** Imports bank transactions.
2. **"Run Auto-Match" (`Zap`):** Automatically pairs matching debits and credits.
3. **"Match Selected Items" (`Link`):** Manually pairs an internal record with a bank line.
4. **"Post Bank Adjustment" (`Plus`):** Logs bank fees or interest not previously recorded.

### 9. Complete Workflow
1. Accountant downloads monthly statement from HDFC Bank netbanking.
2. Uploads CSV statement -> System displays bank lines on right side.
3. Clicks "Run Auto-Match" -> 95% of transactions match automatically.
4. Accountant manually matches the remaining 5% (e.g. slight date delays).
5. Unreconciled difference reaches ₹0.00 -> Accountant locks monthly reconciliation.

### 10. Data Entry Explanation
- *Statement Date:* Closing date of the bank statement.
- *Closing Bank Balance:* Exact final balance printed on the official bank statement.

### 11. Status Explanation
- `UNMATCHED`: Line item not yet paired.
- `MATCHED`: Successfully verified between bank and hospital books.
- `RECONCILED`: Entire month balanced and locked.

### 12. Database Explanation
- Stored in: `billing_bankaccount`, `billing_bankstatementline`, `billing_bankreconciliation`.

### 13. Module Connections
- Feeds verified cash balances into General Ledger and Balance Sheet.

### 14. Permissions
- Accountants reconcile; Finance Managers review and lock monthly statements.

### 15. Error Handling
- System highlights unmatched differences in red until difference reaches exactly zero.

### 16. Practical Examples
- Identifying a ₹590 annual bank debit card fee and recording it as a Bank Charges expense.
- Spotting that a patient's ₹15,000 consultation check bounced due to insufficient funds.

### 17. Important Things to Remember
- Never close a monthly accounting period until the Bank Reconciliation difference is exactly ₹0.00!

---

## 3.23 Module 22: Loans & Long-Term Liabilities (`/staff/loans`)

### 1. Module Name & Route
- **Displayed Name:** 18. Loans & Liabilities
- **Frontend Route:** `/staff/loans`

### 2. Simple Explanation
The hospital loan and debt manager. When the hospital borrows money from banks to construct a new building or buy multi-crore medical equipment (like an MRI scanner or linear accelerator), this module tracks the loan balance, calculates monthly EMI payments, and separates principal from interest.

### 3. Real Hospital Example
The hospital takes a ₹2 Crore medical equipment loan from State Bank of India at 8.5% interest over 5 years. This screen calculates the monthly EMI of ₹4,10,330, showing that ₹2,68,663 goes toward paying off the loan (Principal) and ₹1,41,667 goes toward Bank Interest.

### 4. Who Uses It?
Chief Financial Officers, Senior Accountants, Financial Controllers.

### 5. Why Does This Module Exist?
Prevents default on bank loans, tracks debt obligations, and ensures interest expense is correctly deducted on hospital corporate income tax filings.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Outstanding Loan Principal, Total Monthly EMI Burden, Next EMI Due Date, Total Interest Paid This Fiscal Year.
- **Loan Portfolio Table:** Loan Account #, Lending Bank, Purpose (Equipment, Building, Working Capital), Original Loan (₹), Outstanding Balance (₹), Interest Rate %, EMI Amount (₹), Actions.
- **Amortization Schedule Modal:** Month-by-month table showing future principal and interest splits for all 60 months.

### 7. Every Tab Explained
- *Active Loans Tab:* Current ongoing bank loans and mortgages.
- *Amortization Schedules Tab:* Projected repayment timetables.
- *Settled Loans Archive Tab:* Fully repaid historical bank debts.

### 8. Every Button Explained
1. **"Record New Loan" (`PlusCircle`):** Sets up a new bank loan facility.
2. **"Log EMI Payment" (`Check`):** Records monthly EMI debit, splitting principal and interest.
3. **"View Amortization Schedule" (`Calendar`):** Generates complete 5-year repayment schedule.

### 9. Complete Workflow
1. Hospital borrows ₹1 Crore for CT Scanner.
2. Finance Manager enters Loan Amount, Bank, Rate (8.5%), Tenure (60 Months).
3. System generates full amortization schedule.
4. On 5th of every month, accountant clicks "Log EMI Payment".
5. Debits: `Loan Principal (₹1,34,331)` and `Interest Expense (₹70,833)`; Credits: `HDFC Bank (₹2,05,164)`.

### 10. Data Entry Explanation
- *Tenure:* Loan duration in months (e.g. 36, 60, 84 months).
- *Interest Type:* Fixed Rate or Floating (Repo-linked) Rate.

### 11. Status Explanation
- `ACTIVE`: Actively repaying monthly EMIs.
- `PAID_OFF`: Fully repaid with bank No Objection Certificate (NOC).
- `RESTRUCTURED`: Tenure or interest rate renegotiated with bank.

### 12. Database Explanation
- Stored in: `billing_loanliability`, `billing_loanrepaymentschedule`, `billing_emipaymentlog`.

### 13. Module Connections
- Deducts EMI payments from Bank Accounts; posts interest to Profit & Loss; posts debt to Balance Sheet.

### 14. Permissions
- Restricted to FINANCE_MANAGER and SUPER_ADMIN.

### 15. Error Handling
- Warns management 7 days before EMI due date if operating bank account has insufficient balance.

### 16. Practical Examples
- Refinancing an existing 10% loan down to 8.25%, saving the hospital ₹4.2 Lakhs in annual interest.
- Recording final EMI check and receiving bank mortgage release deed.

### 17. Important Things to Remember
- Always separate Principal from Interest; Principal reduces liabilities, while Interest is an operating expense!

---

## 3.24 Module 23: Double-Entry General Ledger Accounting (`/staff/general-ledger`)

### 1. Module Name & Route
- **Displayed Name:** 19. Accounting & General Ledger
- **Frontend Route:** `/staff/general-ledger`

### 2. Simple Explanation
The master financial memory of the hospital. Built on standard double-entry bookkeeping rules, every single rupee that moves through the hospital writes balanced debit and credit entries. If one account is debited, another must be credited so the books always balance perfectly (`Total Debits == Total Credits`).

### 3. Real Hospital Example
A patient pays ₹800 cash for an X-ray. The system automatically creates a journal entry:
- **Debit:** Cash in Hand Account (`+₹800`)
- **Credit:** Radiology Revenue Account (`+₹800`)
Total Debits equal ₹800, Total Credits equal ₹800. The transaction is balanced, permanent, and tamper-proof.

### 4. Who Uses It?
Chief Financial Officers, Senior Accountants, External Chartered Accountants (CA), Statutory Auditors.

### 5. Why Does This Module Exist?
Prevents financial fraud, eliminates single-entry accounting mistakes, and produces certified Trial Balances, Profit & Loss statements, and Balance Sheets.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Debits Posted, Total Credits Posted, Trial Balance Variance (must be ₹0.00), Journal Entries Posted Today.
- **Journal Entry Worklist Table:** Voucher #, Date, Source Module (Billing, Pharmacy, Payroll, Manual), Narration, Total Debit (₹), Total Credit (₹), Status, Actions.
- **Journal Voucher Drafting Modal:** Multi-line entry grid allowing accountants to select multiple debit and credit ledger rows.
- **Trial Balance Viewer:** Instant summary of all accounts showing debit and credit balances side by side.

### 7. Every Tab Explained
- *Journal Entries Tab:* Chronological register of all financial vouchers.
- *Trial Balance Tab:* Real-time balance verification across all accounts.
- *General Ledger Book Tab:* Individual account view showing transaction history.
- *Audit Reversals Tab:* Official reversing vouchers for corrected errors.

### 8. Every Button Explained
1. **"Post Journal Voucher" (`Plus`):** Opens manual voucher drafting modal.
2. **"Validate Debits & Credits" (`Scale`):** Verifies that Debits equal Credits before saving.
3. **"Export Trial Balance" (`Download`):** Exports official Trial Balance PDF for tax auditors.
4. **"Reverse Voucher" (`RotateCcw`):** Creates an audited, timestamped reversing entry for an error.

### 9. Complete Workflow
1. Accountant drafts journal voucher (e.g. paying ₹50,000 annual fire insurance).
2. Row 1: Debits `Prepaid Insurance Asset` for ₹50,000.
3. Row 2: Credits `HDFC Bank Account` for ₹50,000.
4. System verifies `Total Debits == Total Credits`.
5. Finance Manager clicks "Post Voucher". Entry permanently updates General Ledger.

### 10. Data Entry Explanation
- *Voucher Type:* Journal Voucher (JV), Payment Voucher (PV), Receipt Voucher (RV), Contra Voucher (CV).
- *Narration:* Required clear sentence explaining the business reason.

### 11. Status Explanation
- `DRAFT`: Prepared by accountant, awaiting review.
- `POSTED`: Permanently committed to General Ledger (immutable).
- `REVERSED`: Corrected via an authorized contra-reversing voucher.

### 12. Database Explanation
- Stored in: `billing_journalentry`, `billing_journalentryline`, `billing_generalledgerposting`.

### 13. Module Connections
- Receives automated postings from Billing, Pharmacy, Inventory, Assets, and Payroll; feeds Trial Balance and P&L.

### 14. Permissions
- Accountants draft; Finance Managers post (Separation of Duties).
- Deleting posted entries is strictly prohibited by database triggers.

### 15. Error Handling
- System strictly blocks posting any voucher where Debits do not equal Credits down to the exact paisa.

### 16. Practical Examples
- Automated posting of ₹82,000 daily pharmacy sales at midnight.
- Manual depreciation voucher debiting Depreciation Expense and crediting Medical Equipment Accumulated Depreciation.

### 17. Important Things to Remember
- Never delete a journal entry; in professional accounting, errors are corrected only by posting an audited reversing entry!

---

## 3.25 Module 24: Budgeting & Cash Flow Forecasting (`/staff/budgeting`)

### 1. Module Name & Route
- **Displayed Name:** 20. Budgeting & Cash Flow
- **Frontend Route:** `/staff/budgeting`

### 2. Simple Explanation
The hospital's future financial plan and spending radar. It sets annual spending limits for each department (e.g. Cardiology cannot spend more than ₹20 Lakhs on supplies this year) and forecasts future cash flow so the hospital never runs out of money to pay salaries.

### 3. Real Hospital Example
The Pathology department wants to spend ₹3,00,000 on new laboratory reagents in October. The Finance Manager checks the Budget screen: Pathology has only ₹1,20,000 remaining in its Q3 budget. The system flags a "Budget Overrun Warning", prompting the department head to prioritize critical tests.

### 4. Who Uses It?
Chief Financial Officers, Department Heads, Hospital Administrators, Board Members.

### 5. Why Does This Module Exist?
Prevents departmental overspending, stops fiscal emergencies, and plans cash reserves for quarterly bonuses and tax payments.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Annual Hospital Budget, Budget Utilized To Date %, Projected Cash Runway (e.g. 8.4 Months), High-Risk Overrun Departments.
- **Departmental Budget Allocation Table:** Department Name, Allocated Budget (₹), Spent To Date (₹), Remaining Balance (₹), Utilization %, Status Bar (Green/Yellow/Red).
- **Cash Flow Forecast Curve:** Visual chart projecting cash inflows and outflows over the next 12 months.

### 7. Every Tab Explained
- *Departmental Budgets Tab:* Operating expense limits by department.
- *Capital Expenditure (CapEx) Tab:* High-value equipment and construction budgets.
- *12-Month Cash Forecast Tab:* Projected liquidity and cash balances.

### 8. Every Button Explained
1. **"Allocate Department Budget" (`Plus`):** Sets annual spending cap for a department.
2. **"Simulate Cash Flow Scenario" (`Sliders`):** Models impact of a 10% drop in patient volume.
3. **"Export Budget Variance Report" (`Download`):** Downloads budget vs. actual report for board review.

### 9. Complete Workflow
1. Finance Committee allocates ₹80 Lakhs annual budget for Operation Theatre consumables.
2. Every time OT issues a purchase order, system deducts amount from budget balance.
3. If spending exceeds 85%, system flashes Yellow alert.
4. If spending exceeds 100%, system blocks further purchase orders without CFO override.

### 10. Data Entry Explanation
- *Budget Period:* Fiscal Year (e.g. FY 2026-2027), divided into Q1, Q2, Q3, Q4.
- *Threshold Alert:* Percentage (e.g. 85%) that triggers advance warning.

### 11. Status Explanation
- `ON_TRACK`: Spending under 80% of budget.
- `WARNING`: Spending between 80% and 95%.
- `OVERRUN`: Spending exceeded 100% (requires emergency board sanction).

### 12. Database Explanation
- Stored in: `billing_departmentbudget`, `billing_budgetallocation`, `billing_cashflowprojection`.

### 13. Module Connections
- Validates purchase requisitions in Inventory and payroll expenses in HR.

### 14. Permissions
- CFO sets budgets; Department Heads view their own department utilization.

### 15. Error Handling
- Blocks purchase order approval if requesting department has zero budget balance remaining.

### 16. Practical Examples
- Dialysis ward stays within 91% of its annual water filter replacement budget.
- CFO simulates purchasing a ₹45 Lakh MRI scanner to verify cash reserves remain healthy.

### 17. Important Things to Remember
- Review budget variances monthly so departmental overspending is caught before it hurts hospital finances!

---

## 3.26 Module 25: Real-Time Profit & Loss Statement (`/staff/profit-loss`)

### 1. Module Name & Route
- **Displayed Name:** 21. Profit & Loss Statement (P&L)
- **Frontend Route:** `/staff/profit-loss`

### 2. Simple Explanation
The hospital's ultimate financial report card. In real time, it adds up all hospital income (OPD fees, bed charges, surgery, pharmacy, lab) and subtracts all hospital expenses (doctor fees, nurse salaries, medicine purchases, electricity, oxygen). The bottom line shows whether the hospital made a profit (surplus) or a loss this month.

### 3. Real Hospital Example
On October 31st at 6:00 PM, the Hospital Owner logs in. The screen calculates: Total Revenue is ₹84,50,000; Total Operating Expenses are ₹68,20,000. The hospital earned a healthy net operational surplus of ₹16,30,000 (19.3% margin) for October.

### 4. Who Uses It?
Hospital Owners, Board of Directors, Chief Financial Officers, Hospital Administrators.

### 5. Why Does This Module Exist?
Eliminates waiting 3 weeks after month-end for accountants to prepare manual spreadsheets. Hospital owners see exact profitability *in real time*.

### 6. Complete Screen Explanation
- **Top Financial Indicators:** Gross Revenue, Operating Expenses, Net Operating Profit (EBITDA), Net Profit Margin %.
- **Revenue Breakdown Panel:** OPD Consultations, Inpatient Room Rent, Operation Theatre, Pharmacy Sales, Laboratory, Radiology.
- **Operating Expense Breakdown:** Staff Salaries & Benefits, Medicine & Supply Consumables, Utilities & Power, Equipment AMC Maintenance, Depreciation.
- **Interactive Date Filter:** View Today, This Week, This Month, This Quarter, or Full Fiscal Year.

### 7. Every Tab Explained
- *Executive P&L Summary Tab:* High-level statement showing gross revenue, expenses, and net surplus.
- *Departmental Profitability Tab:* Breakdown showing which medical departments generate the highest margins.
- *Comparative Trends Tab:* Comparing this year's monthly revenue against last year's performance.

### 8. Every Button Explained
1. **"Date Range Selector" (`Calendar`):** Switches between Monthly, Quarterly, and Annual statements.
2. **"Drill-Down to Ledger" (`Search`):** Clicks an expense line (e.g. Electricity) to view every individual supporting bill.
3. **"Export Certified P&L PDF" (`Download`):** Downloads audited P&L statement for banks and board meetings.

### 9. Complete Workflow
1. Executive opens `/staff/profit-loss`.
2. System queries General Ledger database across selected date range.
3. Automatically sums all 4000-series accounts (Revenue) and 5000-series accounts (Expenses).
4. Calculates Net Surplus (`Total Revenue - Total Expenses`).
5. Displays interactive charts and departmental margin breakdown.

### 10. Data Entry Explanation
- Automated reporting screen; zero manual data entry. All figures derived directly from posted General Ledger entries.

### 11. Status Explanation
- `SURPLUS`: Hospital operating profitably (Revenue > Expenses).
- `DEFICIT`: Hospital operating at a loss (Expenses > Revenue).

### 12. Database Explanation
- Real-time aggregation query over `billing_journalentryline` joined with `billing_chartofaccount`.

### 13. Module Connections
- Consolidates financial data from Billing, Pharmacy, Inventory, Payroll, and Assets.

### 14. Permissions
- Restricted to SUPER_ADMIN, HOSPITAL_ADMIN, and FINANCE_MANAGER.

### 15. Error Handling
- If unposted draft journal vouchers exist, displays alert: "Draft entries pending; figures reflect posted entries only."

### 16. Practical Examples
- Discovering that the Pharmacy generated ₹28 Lakhs revenue with ₹19 Lakhs drug cost (₹9 Lakhs gross profit).
- Spotting that electricity costs spiked 25% in May due to intensive air conditioning during peak summer heatwave.

### 17. Important Things to Remember
- A healthy hospital requires consistent positive operating surplus to reinvest in new medical technology and patient care!
"""

