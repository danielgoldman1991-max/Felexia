"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ManualDeliveryOrderOption } from "@/lib/sales-types";

type Props = {
  orders: ManualDeliveryOrderOption[];
  selectedOrderId?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

export function DeliveryOrderSelector({ orders, selectedOrderId }: Props) {
  const [query, setQuery] = useState("");
  const filteredOrders = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return orders;

    return orders.filter((order) =>
      [
        order.document_number,
        order.customer_name,
        order.document_date,
        order.status,
      ].some((value) => normalize(value).includes(needle)),
    );
  }, [orders, query]);

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">Commande a livrer</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Selectionnez une commande confirmee ou partiellement livree avec un reliquat disponible.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une commande, un client, une date..."
        />

        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
          <Table>
            <thead>
              <tr>
                <Th>Commande</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th>Statut</Th>
                <Th>Avancement</Th>
                <Th>Reste a livrer</Th>
                <Th>Total TTC</Th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const selected = order.id === selectedOrderId;

                  return (
                    <tr key={order.id}>
                      <Td>
                        <Link
                          href={`/vente/livraisons/new?orderId=${order.id}`}
                          className={cn(
                            "font-semibold text-[var(--secondary)] underline-offset-4 hover:text-[var(--primary)] hover:underline",
                            selected ? "text-[var(--primary)]" : "",
                          )}
                        >
                          {order.document_number}
                        </Link>
                      </Td>
                      <Td>{order.customer_name ?? "-"}</Td>
                      <Td>{formatDate(order.document_date)}</Td>
                      <Td>{order.status === "partially_delivered" ? "Partiellement livree" : "Confirmee"}</Td>
                      <Td>
                        {formatNumber(order.delivered_total_quantity)} / {formatNumber(order.ordered_total_quantity)}
                      </Td>
                      <Td className="font-semibold text-[var(--secondary)]">
                        {formatNumber(order.remaining_total_quantity)}
                      </Td>
                      <Td><MoneyDisplay value={order.total_ttc} /></Td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    Aucune commande livrable trouvee.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
