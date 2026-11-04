---
title: "Troque Booqable pelo RoveHQ"
description: "Exporte seus pedidos, clientes e estoque do Booqable em CSV e traga tudo para o RoveHQ em poucos minutos. Importamos de graça."
updated: 2026-11-03
exports:
  - "Orders (reservas) em CSV, na lista Orders"
  - "Customers (clientes) em CSV"
  - "Inventory (estoque) em CSV, uma linha por item quando os produtos são controlados individualmente"
  - "Reports (desempenho de produtos, clientes) em CSV"
steps:
  - "No Booqable, abra Orders, role até o fim da lista e clique em Export."
  - "Faça o mesmo em Customers e em Inventory."
  - "No RoveHQ, abra Frota, depois Importar, escolha Booqable e envie os arquivos CSV juntos."
  - "Confira o que foi encontrado e depois importe."
faq:
  - q: "O RoveHQ copia as cauções do Booqable como receita?"
    a: "Não. A caução de um pedido é registrada como caução retida, não como receita."
  - q: "Posso importar vários arquivos do Booqable de uma vez?"
    a: "Sim. Envie pedidos, clientes e estoque juntos e o RoveHQ liga uns aos outros."
---
As exportações do Booqable são arquivos CSV com uma coluna para cada campo da página, e você pode adicionar ou remover colunas antes de exportar. O RoveHQ reconhece os arquivos de pedidos, clientes e estoque do Booqable pelos cabeçalhos e lê tudo sem adivinhar.

## Como os status são trazidos

- Pedidos **Reserved** (reservados) viram reservas futuras.
- Pedidos **Started** (retirados) viram aluguéis em andamento.
- Pedidos **Stopped** (devolvidos) e **archived** (arquivados) viram aluguéis passados.
- Pedidos **Draft** (rascunho) e **cancelled** (cancelados) aparecem na lista, mas ficam de fora a menos que você os marque.

O identificador de um item (muitas vezes a placa ou um número de frota) vira a placa do veículo. Os pedidos são ligados aos clientes pelo nome e aos veículos quando o identificador está na exportação.

Ainda está decidindo? Leia nossa [comparação Booqable vs RoveHQ](/guides/booqable-vs-rovehq) ou nossa lista de [alternativas ao Booqable para locação de veículos](/guides/booqable-alternatives).

## Importação grátis

A importação é grátis em todos os planos. O RoveHQ reconhece as exportações do Booqable e lê na hora. Você vê cada veículo, reserva e pagamento antes de qualquer coisa ser salva, e pode desfazer toda a importação por 30 dias. Se preferir não fazer isso sozinho, [envie os arquivos para a gente](/contact) e nós importamos para você.
