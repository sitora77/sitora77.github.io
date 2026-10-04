'use strict';
(() => {
  const fixture = JSON.parse(document.getElementById('case-inputs').textContent);
  const t = JSON.parse(document.getElementById('case-locale').textContent);
  const money = n => `US$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const day = n => n.toFixed(2), name = r => t.option_names[r.option_id] || r.option;
  const ids = ['delay', 'stock', 'rate', 'cash', 'demand', 'payment', 'funding', 'deadline', 'minimum'];
  const get = id => document.getElementById(id);
  const status = get('calculation-status'), notice = get('decision-notice');
  let current, rows, decision, valid = false;
  function cells(values) {
    const tr = document.createElement('tr');
    values.forEach(value => {const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);});
    return tr;
  }
  function summaryLabel(summary, comparison) {
    const selected = comparison.find(r => r.option_id === summary.recommended_option_id);
    return selected ? name(selected) : t.no_eligible;
  }
  function result() {
    return {data_status: 'Constructed assumptions, not observed savings or approved financing',
      inputs: current, decision, comparison: rows};
  }
  function drawLedger() {
    if (!rows) return;
    const row = rows.find(r => r.option_id === get('ledger-option').value);
    if (!row) return;
    const body = get('ledger-body'); body.replaceChildren();
    row.events.forEach(e => body.appendChild(cells([day(e.day),
      e.event.split('; ').map(part => t.events[part] || part).join('; '),
      money(e.net_flow), money(e.cash_balance), money(e.funding_need)])));
    get('ledger-note').textContent = `${row.funding_dollar_days.toLocaleString('en-US')} USD-days × ${(current.order.annual_funding_rate * 100).toFixed(1)}% ÷ 365 = ${money(row.funding_cost)}${t.ledger_suffix}${row.residual_funding_need > 0 ? ' ' + t.residual : ''}`;
  }
  function calculate() {
    try {
      for (const id of ids) if (!get(id).checkValidity()) throw new Error(t.invalid);
      const candidate = JSON.parse(JSON.stringify(fixture));
      candidate.selected_port_delay_days = Number(get('delay').value);
      Object.assign(candidate.order, {
        stock_cover_days: Number(get('stock').value), annual_funding_rate: Number(get('rate').value) / 100,
        initial_cash: Number(get('cash').value), daily_demand: Number(get('demand').value),
        customer_payment_days: Number(get('payment').value)
      });
      candidate.constraints = {
        funding_limit: get('funding').value.trim() === '' ? null : Number(get('funding').value),
        latest_availability_day: get('deadline').value.trim() === '' ? null : Number(get('deadline').value),
        minimum_net_contribution: Number(get('minimum').value)
      };
      const computed = HarborShieldCase.compare(candidate);
      current = candidate; rows = computed; decision = HarborShieldCase.decisionSummary(rows); valid = true;
      const best = rows.find(r => r.option_id === decision.recommended_option_id);
      const body = get('comparison-body'); body.replaceChildren();
      rows.forEach(r => {
        const tr = cells([name(r), day(r.availability_day), money(r.logistics_cost),
          money(r.stockout_opportunity_cost), money(r.funding_cost), money(r.economic_burden),
          money(r.net_economic_contribution), r.eligible ? t.eligible : r.ineligibility_reasons.map(code => t.reasons[code]).join('; ')]);
        if (best && r.option_id === best.option_id) tr.classList.add('selected');
        body.appendChild(tr);
      });
      get('best-option').textContent = best ? name(best) : t.no_eligible;
      get('best-burden').textContent = best ? money(best.economic_burden) : '—';
      get('peak-funding').textContent = best ? money(best.peak_funding_need) : '—';
      notice.className = best ? 'decision-notice' : 'decision-notice warning';
      notice.textContent = best ? t.valid_notice : t.none_notice;
      get('unconstrained-note').textContent = t.unconstrained_prefix + name(rows[0]);
      const baseline = HarborShieldCase.compare(current, 0);
      get('baseline-note').textContent = t.baseline_prefix + summaryLabel(HarborShieldCase.decisionSummary(baseline), baseline);
      const select = get('ledger-option'), previous = select.value; select.replaceChildren();
      rows.forEach(r => {const o = document.createElement('option'); o.value = r.option_id; o.textContent = name(r); select.appendChild(o);});
      if (rows.some(r => r.option_id === previous)) select.value = previous;
      else if (best) select.value = best.option_id;
      select.disabled = false; drawLedger();
      get('current-result').textContent = JSON.stringify(result(), null, 2);
      status.textContent = t.updated; get('download-case').disabled = false;
      const params = new URLSearchParams();
      ids.forEach(id => params.set(id, get(id).value));
      get('language-switch').href = t.switch_url + '?' + params.toString();
    } catch (error) {
      valid = false; status.textContent = t.invalid_status;
      notice.className = 'decision-notice invalid'; notice.textContent = t.invalid;
      get('best-option').textContent = '—'; get('best-burden').textContent = '—'; get('peak-funding').textContent = '—';
      get('download-case').disabled = true; get('ledger-option').disabled = true;
      get('current-result').textContent = t.invalid_status;
      get('language-switch').href = t.switch_url;
      get('unconstrained-note').textContent = ''; get('baseline-note').textContent = '';
      get('comparison-body').querySelectorAll('.selected').forEach(row => row.classList.remove('selected'));
    }
  }
  const params = new URLSearchParams(window.location.search);
  ids.forEach(id => {
    if (params.has(id)) get(id).value = params.get(id);
    get(id).addEventListener('input', calculate);
  });
  get('ledger-option').addEventListener('change', drawLedger);
  get('download-case').addEventListener('click', () => {
    if (!valid) return;
    const blob = new Blob([JSON.stringify(result(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'harborshield-case-result.json';
    document.body.appendChild(a); a.click(); status.textContent = t.download_status;
    setTimeout(() => {a.remove(); URL.revokeObjectURL(url);}, 30000);
  });
  get('reset-case').addEventListener('click', () => {
    const defaults = [fixture.selected_port_delay_days, fixture.order.stock_cover_days,
      fixture.order.annual_funding_rate * 100, fixture.order.initial_cash, fixture.order.daily_demand,
      fixture.order.customer_payment_days, fixture.constraints.funding_limit ?? '',
      fixture.constraints.latest_availability_day ?? '', fixture.constraints.minimum_net_contribution ?? 0];
    ids.forEach((id, index) => {get(id).value = defaults[index];}); calculate();
  });
  calculate();
})();
