/* Browser/Node counterpart of business_case.py. No network, accounts or credit decisions. */
(function (root) {
  'use strict';
  function number(record, key, min = 0, max = 1e9) {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key}: finite numeric value between ${min} and ${max} required`);
    }
    return value;
  }
  function validateCase(c) {
    if (!c || !c.order || !Array.isArray(c.options) || c.options.length < 1 || c.options.length > 20) throw new Error('Invalid case');
    const o = c.order;
    if (o.currency !== 'USD') throw new Error('USD only; no implicit FX conversion');
    if (typeof o.order_id !== 'string' || !o.order_id.trim()) throw new Error('order_id required');
    if (!Number.isInteger(number(o, 'quantity', 1, 1e7))) throw new Error('Whole quantity required');
    ['unit_purchase_price', 'unit_sale_price', 'daily_demand', 'initial_cash'].forEach(k => number(o, k));
    if (o.unit_sale_price < o.unit_purchase_price) throw new Error('Sale price must be at least purchase price');
    ['stock_cover_days', 'customer_payment_days'].forEach(k => number(o, k, 0, 365));
    number(o, 'supplier_deposit_day', -365, 0);
    number(o, 'supplier_deposit_fraction', 0, 1);
    number(o, 'annual_funding_rate', 0, 1);
    number(c, 'selected_port_delay_days', 0, 365);
    const ids = new Set();
    for (const option of c.options) {
      if (typeof option.id !== 'string' || !option.id || ids.has(option.id) || typeof option.name !== 'string' || !option.name) throw new Error('Unique option ids and names required');
      ids.add(option.id);
      ['transit_days', 'document_release_days'].forEach(k => number(option, k, 0, 365));
      number(option, 'port_delay_multiplier', 0, 10);
      ['freight_cost', 'insurance_premium', 'other_logistics_cost'].forEach(k => number(option, k));
    }
  }
  function fundingLedger(events, initialCash, rate) {
    number({cash: initialCash}, 'cash'); number({rate}, 'rate', 0, 1);
    if (!events.length) throw new Error('Events required');
    const grouped = new Map();
    for (const event of events) {
      number(event, 'day', -365, 5000); number(event, 'amount', -1e15, 1e15);
      if (!grouped.has(event.day)) grouped.set(event.day, []);
      grouped.get(event.day).push(event);
    }
    const days = [...grouped.keys()].sort((a, b) => a - b);
    let balance = initialCash, area = 0, peak = 0, previous = days[0];
    const rows = [];
    for (const day of days) {
      area += Math.max(-balance, 0) * (day - previous);
      const flows = grouped.get(day), amount = flows.reduce((sum, event) => sum + event.amount, 0);
      balance += amount; peak = Math.max(peak, -balance);
      rows.push({day, event: flows.map(e => e.label || 'Cash flow').join('; '), net_flow: amount,
        cash_balance: balance, funding_need: Math.max(-balance, 0)});
      previous = day;
    }
    return {events: rows, funding_dollar_days: area, funding_cost: area * rate / 365,
      peak_funding_need: peak, closing_cash_before_interest: balance, residual_funding_need: Math.max(-balance, 0)};
  }
  function evaluate(o, p, delay) {
    const purchase = o.quantity * o.unit_purchase_price, sales = o.quantity * o.unit_sale_price;
    const availability = p.transit_days + delay * p.port_delay_multiplier + p.document_release_days;
    const shortage = Math.max(availability - o.stock_cover_days, 0);
    const units = Math.min(o.quantity, shortage * o.daily_demand);
    const opportunity = units * (o.unit_sale_price - o.unit_purchase_price);
    const logistics = p.freight_cost + p.insurance_premium + p.other_logistics_cost;
    const collection = availability + o.customer_payment_days, deposit = purchase * o.supplier_deposit_fraction;
    const ledger = fundingLedger([
      {day: o.supplier_deposit_day, amount: -deposit, label: 'Supplier deposit'},
      {day: 0, amount: -(purchase - deposit), label: 'Supplier balance'},
      {day: 0, amount: -logistics, label: 'Logistics paid'},
      {day: collection, amount: sales, label: 'Constructed customer receipt'}
    ], o.initial_cash, o.annual_funding_rate);
    const burden = logistics + ledger.funding_cost + opportunity;
    return {option_id: p.id, option: p.name, currency: 'USD', availability_day: availability,
      collection_day: collection, stockout_days: shortage, unmet_units: units, purchase_value: purchase,
      sales_receipt: sales, planned_contribution: sales - purchase, logistics_cost: logistics,
      stockout_opportunity_cost: opportunity, economic_burden: burden,
      net_economic_contribution: sales - purchase - burden, ...ledger};
  }
  function compare(c, delay = c.selected_port_delay_days) {
    validateCase({...c, selected_port_delay_days: delay});
    return c.options.map(p => evaluate(c.order, p, delay)).sort((a, b) =>
      a.economic_burden - b.economic_burden || a.option_id.localeCompare(b.option_id));
  }
  const api = {validateCase, fundingLedger, compare};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HarborShieldCase = api;
})(globalThis);
