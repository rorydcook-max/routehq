---
title: "Troque HQ Rental Software pelo RoveHQ"
description: "Exporte suas reservas, veículos e clientes do HQ Rental Software para Excel e traga tudo para o RoveHQ. Importamos de graça."
updated: 2026-11-03
exports:
  - "Qualquer tabela (reservas, veículos, clientes) para Excel, com as colunas que você escolher"
  - "Relatórios para Excel ou PDF"
  - "Uma API para desenvolvedores"
steps:
  - "No HQ Rental Software, abra Car Rental, depois Reservations, filtre se precisar e adicione as colunas que quiser."
  - "Clique no menu no canto superior direito da tabela, depois em Actions e em Export."
  - "Faça o mesmo em Vehicles e Customers."
  - "No RoveHQ, abra Frota, depois Importar, escolha HQ Rental Software e envie os arquivos juntos."
faq:
  - q: "Preciso da API do HQ?"
    a: "Não. As exportações para Excel bastam. A API está lá se um desenvolvedor preferir."
---
A base de conhecimento do HQ diz que você pode exportar para Excel todas as tabelas e relatórios do sistema. O RoveHQ reconhece as exportações de reservas e veículos do HQ pelos cabeçalhos (datas e locais de retirada e devolução, categoria do veículo, placa, hodômetro).

## Como os status são trazidos

- Reservas **Open** e **Pending** viram reservas futuras.
- Reservas **Rental** viram aluguéis em andamento.
- Reservas **Completed** viram aluguéis passados.
- **Quote**, **Cancelled** e **No Show** aparecem na lista, mas ficam de fora a menos que você os marque.

O total pago e a caução vêm separados, então uma caução que você segura nunca conta como receita.

Ainda está decidindo? Leia nossa [comparação HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Importação grátis

A importação é grátis em todos os planos. O RoveHQ reconhece as exportações do HQ Rental Software e lê na hora. Você vê cada veículo, reserva e pagamento antes de qualquer coisa ser salva, e pode desfazer toda a importação por 30 dias. Se preferir não fazer isso sozinho, [envie os arquivos para a gente](/contact) e nós importamos para você.
