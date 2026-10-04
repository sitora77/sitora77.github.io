'use strict';
(() => {
  const fixture = JSON.parse(document.getElementById('case-inputs').textContent);
  const money = n => `US$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const day = n => n.toFixed(2);
  const ids = ['delay', 'stock', 'rate', 'cash', 'demand', 'payment'];
  const status = document.getElementById('calculation-status');
  let current, rows;
  function cells(values) {
    const tr = document.createElement('tr');
    values.forEach(value => {const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);});
    return tr;
  }
  function drawLedger() {
    if (!rows) return;
    const row = rows.find(r => r.option_id === document.getElementById('ledger-option').value);
    if (!row) return;
    const body = document.getElementById('ledger-body'); body.replaceChildren();
    row.events.forEach(e => body.appendChild(cells([day(e.day), e.event, money(e.net_flow), money(e.cash_balance), money(e.funding_need)])));
    document.getElementById('ledger-note').textContent = `${row.funding_dollar_days.toLocaleString('en-US')} USD-days × ${(current.order.annual_funding_rate * 100).toFixed(1)}% ÷ 365 = ${money(row.funding_cost)}。计算截止到客户回款，不包含此后的剩余债务利息。`;
  }
  function calculate() {
    try {
      for (const id of ids) {if (!document.getElementById(id).checkValidity()) throw new Error('请在允许范围内填写全部输入。');}
      current = JSON.parse(JSON.stringify(fixture));
      current.selected_port_delay_days = Number(document.getElementById('delay').value);
      Object.assign(current.order, {
        stock_cover_days: Number(document.getElementById('stock').value),
        annual_funding_rate: Number(document.getElementById('rate').value) / 100,
        initial_cash: Number(document.getElementById('cash').value),
        daily_demand: Number(document.getElementById('demand').value),
        customer_payment_days: Number(document.getElementById('payment').value)
      });
      rows = HarborShieldCase.compare(current);
      const body = document.getElementById('comparison-body'); body.replaceChildren();
      rows.forEach(r => body.appendChild(cells([r.option, day(r.availability_day), money(r.logistics_cost),
        money(r.stockout_opportunity_cost), money(r.funding_cost), money(r.economic_burden), money(r.net_economic_contribution)])));
      document.getElementById('best-option').textContent = rows[0].option;
      document.getElementById('best-burden').textContent = money(rows[0].economic_burden);
      document.getElementById('peak-funding').textContent = money(rows[0].peak_funding_need);
      document.getElementById('baseline-note').textContent = `同样订单、无额外港口等待：最低假设经济负担为 ${HarborShieldCase.compare(current, 0)[0].option}。方案是否实际可订舱仍需业务核实。`;
      const select = document.getElementById('ledger-option'), previous = select.value;
      select.replaceChildren();
      rows.forEach(r => {const o = document.createElement('option'); o.value = r.option_id; o.textContent = r.option; select.appendChild(o);});
      if (rows.some(r => r.option_id === previous)) select.value = previous;
      drawLedger();
      document.getElementById('current-result').textContent = JSON.stringify({data_status: 'Constructed assumptions, not observed savings', inputs: current, comparison: rows}, null, 2);
      status.textContent = '已按当前假设重新计算 · 本机浏览器计算，无需上传资料';
      document.getElementById('download-case').disabled = false;
    } catch (error) {
      status.textContent = `输入未通过：${error.message}。表中保留的是上次有效结果。`;
      document.getElementById('download-case').disabled = true;
    }
  }
  ids.forEach(id => document.getElementById(id).addEventListener('input', calculate));
  document.getElementById('ledger-option').addEventListener('change', drawLedger);
  document.getElementById('download-case').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({data_status: 'Constructed assumptions, not observed savings', inputs: current, comparison: rows}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'harborshield-case-result.json';
    document.body.appendChild(a); a.click();
    status.textContent = '已请求下载；若浏览器未开始下载，可展开 JSON 结果复制保存。';
    // Keep the URL alive while browsers resolve the download navigation.
    setTimeout(() => {a.remove(); URL.revokeObjectURL(url);}, 30000);
  });
  document.getElementById('reset-case').addEventListener('click', () => {
    const defaults = [fixture.selected_port_delay_days, fixture.order.stock_cover_days,
      fixture.order.annual_funding_rate * 100, fixture.order.initial_cash, fixture.order.daily_demand,
      fixture.order.customer_payment_days];
    ids.forEach((id, index) => {document.getElementById(id).value = defaults[index];}); calculate();
  });
  calculate();
})();
