---
title: "Troque Rental Car Manager pelo RoveHQ"
description: "Gere o Bookings Export do Rental Car Manager com os pagamentos e traga suas reservas para o RoveHQ. Importamos de graça."
updated: 2026-11-03
exports:
  - "Bookings Export: todos os campos das reservas com status Reservation, Hired ou Returned"
  - "Pagamentos lançados em cada reserva (data do pagamento, tipo, referência, valor, taxa da operadora)"
  - "Excel, CSV ou PDF (de preferência Excel ou CSV)"
steps:
  - "No Rental Car Manager, vá em Reports, depois Other Reports e Bookings Export."
  - "Escolha All Dates, marque Include Payments e gere o relatório."
  - "Exporte para Excel ou CSV."
  - "No RoveHQ, abra Frota, depois Importar, escolha Rental Car Manager e envie o arquivo."
---
O Rental Car Manager descreve o Bookings Export como uma extração de dados para analisar numa planilha, o que faz dele um bom jeito de fazer a mudança. O RoveHQ reconhece esse arquivo pelos cabeçalhos.

## Como os status são trazidos

- **Reservation** vira uma reserva futura.
- **Hired** vira um aluguel em andamento.
- **Returned** vira um aluguel passado.

Colunas que você esconde no relatório também ficam fora da exportação, então mostre todas antes de exportar.

Ainda está decidindo? Leia nossa [comparação Rental Car Manager vs RoveHQ](/guides/rental-car-manager-vs-rovehq).

## Importação grátis

A importação é grátis em todos os planos. O RoveHQ reconhece as exportações do Rental Car Manager e lê na hora. Você vê cada veículo, reserva e pagamento antes de qualquer coisa ser salva, e pode desfazer toda a importação por 30 dias. Se preferir não fazer isso sozinho, [envie os arquivos para a gente](/contact) e nós importamos para você.
