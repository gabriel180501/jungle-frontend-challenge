import type { CheckoutQuote } from "./contracts";
import { ethToWei, formatEth, weiToEth } from "../../lib/eth";

interface ComparisonRow {
  id: string;
  label: string;
  before: string;
  after: string;
  difference: string;
  changed: boolean;
}

function moneyRow(id: string, label: string, before: string, after: string): ComparisonRow {
  const difference = ethToWei(after) - ethToWei(before);
  return {
    id,
    label,
    before: `${formatEth(before)} ETH`,
    after: `${formatEth(after)} ETH`,
    difference: difference === 0n
      ? "Sem alteração"
      : `${difference > 0n ? "+" : "−"}${formatEth(weiToEth(difference < 0n ? -difference : difference))} ETH`,
    changed: difference !== 0n,
  };
}

function quantityRow(id: string, label: string, before: number, after: number): ComparisonRow {
  const difference = after - before;
  return {
    id, label, before: String(before), after: String(after),
    difference: difference === 0 ? "Sem alteração" : `${difference > 0 ? "+" : "−"}${Math.abs(difference)}`,
    changed: difference !== 0,
  };
}

export function QuoteComparison({ previous, current }: { previous: CheckoutQuote; current: CheckoutQuote }) {
  const rows: ComparisonRow[] = [];
  const oldItems = new Map(previous.items.map(item => [item.id, item]));
  const newItems = new Map(current.items.map(item => [item.id, item]));
  for (const id of new Set([...oldItems.keys(), ...newItems.keys()])) {
    const before = oldItems.get(id);
    const after = newItems.get(id);
    const item = after ?? before!;
    const name = `${item.name} · ${item.edition}`;
    if (!before || !after) {
      rows.push({
        id: `item-${id}`, label: name,
        before: before ? `${before.quantity} × ${formatEth(before.unitPrice)} ETH` : "Não estava nesta revisão",
        after: after ? `${after.quantity} × ${formatEth(after.unitPrice)} ETH` : "Não está na cotação atual",
        difference: after ? "Adicionado" : "Removido", changed: true,
      });
      continue;
    }
    if (ethToWei(before.unitPrice) !== ethToWei(after.unitPrice))
      rows.push(moneyRow(`price-${id}`, `${name} — Preço por unidade`, before.unitPrice, after.unitPrice));
    if (before.quantity !== after.quantity)
      rows.push(quantityRow(`quantity-${id}`, `${name} — Quantidade`, before.quantity, after.quantity));
    if ((before.quantity > 1 || after.quantity > 1) && ethToWei(before.total) !== ethToWei(after.total))
      rows.push(moneyRow(`items-total-${id}`, `${name} — Total das unidades`, before.total, after.total));
    if (before.available !== after.available)
      rows.push(quantityRow(`availability-${id}`, `${name} — Estoque disponível`, before.available, after.available));
    if (before.limit !== after.limit)
      rows.push(quantityRow(`limit-${id}`, `${name} — Limite por pedido`, before.limit, after.limit));
    if (before.problem !== after.problem)
      rows.push({ id: `problem-${id}`, label: `${name} — Disponibilidade`, before: before.problem || "Disponível", after: after.problem || "Disponível", difference: "Atualizada", changed: true });
  }
  if (previous.quote.coupon !== current.quote.coupon || previous.quote.couponError !== current.quote.couponError) {
    const coupon = (quote: CheckoutQuote["quote"]) => quote.coupon
      ? `${quote.coupon}${quote.couponError ? ` — ${quote.couponError}` : ""}`
      : "Sem cupom";
    rows.push({ id: "coupon", label: "Cupom", before: coupon(previous.quote), after: coupon(current.quote), difference: "Atualizado", changed: true });
  }
  rows.push(
    moneyRow("subtotal", "Subtotal", previous.quote.subtotal, current.quote.subtotal),
    moneyRow("discount", "Desconto (valor abatido)", previous.quote.discount, current.quote.discount),
    moneyRow("network-fee", "Taxa de rede", previous.quote.networkFee, current.quote.networkFee),
    moneyRow("total", "Total", previous.quote.total, current.quote.total),
  );
  return (
    <section className="quote-comparison" aria-labelledby="comparison-title" data-testid="quote-comparison">
      <h3 id="comparison-title">O que mudou na sua compra</h3>
      <table role="table">
        <caption>Última revisão comparada à cotação atual</caption>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Informação</th><th role="columnheader" scope="col">Antes</th><th role="columnheader" scope="col">Agora</th><th role="columnheader" scope="col">Diferença</th></tr></thead>
        <tbody role="rowgroup">
          {rows.map(row => (
            <tr role="row" key={row.id} data-testid={`quote-${row.id}`}>
              <th scope="row" role="rowheader">{row.label}</th>
              <td role="cell"><span className="comparison-mobile-label" aria-hidden="true">Antes</span><span className="quote-value">{row.before}</span></td>
              <td role="cell"><span className="comparison-mobile-label" aria-hidden="true">Agora</span><span className="quote-value">{row.after}</span></td>
              <td role="cell" className="quote-difference" data-changed={row.changed}><span className="comparison-mobile-label" aria-hidden="true">Diferença</span><span className="quote-value">{row.difference}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{rows.some(row => row.changed)
        ? "No desconto, um aumento significa maior abatimento. Confira o total antes de revisar novamente."
        : "Os valores permanecem iguais, mas os dados da compra foram atualizados. Faça uma nova revisão."}</p>
    </section>
  );
}
