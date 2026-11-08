import { h, p, ul, type GuideTranslations } from "./blocks";

const pt: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Preciso de permissão internacional para dirigir? País a país",
    description: "Quais países exigem a permissão internacional para dirigir de visitantes, qual versão aceitam e o que mais levar nos destinos de aluguel mais procurados.",
    standfirst: "A PID é uma tradução da sua carteira de motorista. Alguns países exigem, outros não. Veja como funciona e o que os destinos mais procurados pedem.",
    body: [
      h("O que a PID é, e o que não é"),
      p("A Permissão Internacional para Dirigir traduz sua carteira de motorista para um formato padrão reconhecido pelas convenções internacionais de trânsito. Ela só vale junto com sua carteira definitiva do país de origem, e só para as categorias de veículo que essa carteira cobre. Você tira a PID antes de viajar, no país que emitiu sua carteira."),
      p("Existem três versões, com o nome das convenções que as sustentam: 1926, 1949 e 1968. Cada país aceita a versão (ou versões) das convenções de que faz parte, então a certa depende do seu destino."),
      h("O que os destinos mais procurados pedem"),
      ul([
        "União Europeia: uma carteira de um país da UE ou do EEE vale em toda a UE. Quem vem de fora deve conferir país por país; o governo britânico lista Portugal, Grécia, Itália e Croácia sob a convenção de 1968, e Espanha e Malta sob a de 1949.",
        "Japão: só é aceita a PID em papel da Convenção de Genebra de 1949. Carteiras da Suíça, Alemanha, França, Bélgica, Mônaco e Taiwan são usadas com uma tradução japonesa autorizada. Você pode dirigir por até um ano após a chegada.",
        "Estados Unidos: em geral, visitantes podem dirigir com a carteira do país de origem, mas as regras variam por estado e pode ser preciso ter uma PID (a versão de 1949). Confira cada estado onde vai dirigir e as regras da locadora.",
        "Nova Zelândia: você pode dirigir com uma carteira estrangeira válida por tempo limitado; se ela não estiver em inglês, leve uma tradução para o inglês aprovada.",
        "Costa Rica: uma carteira válida do seu país serve durante a estadia como turista, normalmente até 90 dias.",
        "Emirados Árabes Unidos: visitantes de mais de 30 países podem dirigir com a carteira do país de origem com visto de visita; os demais precisam de PID.",
        "Marrocos: segundo o governo britânico, motoristas britânicos precisam da PID de 1968, e a versão de 1949 não é mais aceita.",
        "Tailândia e Indonésia: visitantes precisam de PID junto com a carteira e, para scooters, as duas devem incluir motocicleta. Veja nossos guias da Tailândia e de Bali."
      ]),
      h("Locadoras podem pedir mais"),
      p("Mesmo onde a lei não exige PID, uma locadora pode exigir, assim como uma idade mínima ou um ano ou mais de habilitação. Se uma locadora na Rove pedir documentos, ela avisa ao confirmar sua reserva."),
      h("Scooters e motos"),
      p("Uma carteira de carro não cobre automaticamente uma scooter. Na Grécia, por exemplo, é preciso ter pelo menos a categoria A1 (motocicleta leve) para alugar um ciclomotor. Pilotar sem a habilitação certa também pode fazer o seguro viagem não pagar depois de um acidente.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Seguro de carro alugado: CDW, franquia e caução",
    description: "O que a CDW cobre, o que é a franquia, por que uma caução fica bloqueada no seu cartão e como evitar cobranças surpresa ao alugar carro ou scooter no exterior.",
    standfirst: "Seguro de aluguel é cheio de siglas. Veja o que significam CDW, franquia e caução, e o que conferir antes de assinar.",
    body: [
      h("Responsabilidade civil"),
      p("O seguro de responsabilidade civil cobre danos ou ferimentos que você cause a outras pessoas. Na UE, todo veículo alugado precisa ter, normalmente incluído no preço. Nos Emirados, a cobertura contra terceiros é incluída por lei. No México, é obrigatória a responsabilidade civil de uma seguradora mexicana, e apólices dos EUA ou do Canadá não valem lá."),
      h("CDW (proteção contra colisão) e franquia"),
      p("A CDW limita quanto você paga se o próprio veículo alugado for danificado, mas raramente elimina todo o custo. O que sobra é a franquia: o máximo que você pagaria pelo dano. A CDW muitas vezes exclui pneus e vidros, então confira o que a sua cobre."),
      p("As locadoras costumam vender uma proteção extra que reduz a franquia (às vezes a zero). Pode sair caro. Um seguro de franquia independente costuma ser mais barato, mas você paga a locadora primeiro e depois pede o reembolso."),
      h("Caução"),
      p("A caução normalmente é um bloqueio no cartão de crédito em nome do motorista. Você não pode gastar esse valor enquanto ele está bloqueado, e ele é liberado quando o veículo volta sem danos, multas ou pedágios pendentes. Nos Emirados, por exemplo, deve ser liberado em até 30 dias. Na Rove, cada veículo mostra a caução antes da reserva."),
      h("Como evitar cobranças surpresa"),
      ul([
        "Antes de sair, dê a volta no veículo com a locadora e fotografe ou filme todos os lados, inclusive por dentro e o nível de combustível. Garanta que qualquer dano esteja anotado no termo de entrega.",
        "Confira a política de combustível, se há limite de quilometragem e o preço de extras como cadeirinhas infantis.",
        "Guarde cópias do contrato e dos relatórios de retirada e devolução.",
        "Se uma disputa com uma locadora de outro país da UE não andar, o Centro Europeu do Consumidor do seu país pode ajudar de graça."
      ]),
      h("Scooters e quadriciclos"),
      p("O seguro vendido com scooters e quadriciclos muitas vezes é só contra terceiros, então você pagaria pelos danos ao próprio veículo. Muitos seguros viagem excluem quadriciclos, e pilotar sem a habilitação certa pode anular sua cobertura.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Alugar carro na Europa: carteira, pedágios e zonas urbanas",
    description: "O que é preciso para alugar e dirigir um carro na Europa: carteira e idade, pedágios eletrônicos, zonas ZTL na Itália, itens obrigatórios e seguro.",
    standfirst: "As regras na Europa mudam de país para país. Estas são as que mais pegam os visitantes de surpresa.",
    body: [
      h("Carteira e idade"),
      p("Uma carteira de um país da UE ou do EEE vale em toda a UE. Com uma carteira de outro lugar, confira cada país onde vai dirigir; alguns pedem a Permissão Internacional para Dirigir. A idade mínima para dirigir carro é 18 anos em Portugal, Espanha, Grécia, Itália e Croácia, mas as locadoras costumam ter sua própria idade mínima (21 é comum em Malta) e podem cobrar mais de menores de 25."),
      h("Pedágios e zonas urbanas"),
      ul([
        "Portugal: algumas autoestradas só têm pedágio eletrônico. Pergunte se o carro tem transponder de pedágio.",
        "Itália: muitos centros de cidade são zonas de tráfego limitado (ZTL), fiscalizadas por câmeras. Entrar sem autorização gera multa, muitas vezes enviada depois pela locadora.",
        "Espanha: algumas cidades têm zonas de baixa emissão, e Barcelona pede que veículos estrangeiros se registrem com antecedência."
      ]),
      h("O que o carro precisa levar"),
      p("Na Croácia, todo carro deve ter triângulo de sinalização, kit de primeiros socorros e coletes refletivos. Confira se estão no carro na retirada. Leve sempre a carteira e um documento de identidade ao dirigir; em Portugal é obrigatório."),
      h("Na estrada"),
      ul([
        "Dirige-se pela direita em todo lugar, exceto em Malta, Chipre, Irlanda e Reino Unido.",
        "O limite de álcool habitual em Portugal, Espanha e Grécia é de 0,05% (0,5 g/l), menor para motoristas novatos.",
        "Na Espanha, usar o celular ao volante é proibido mesmo parado no acostamento, e crianças com menos de 1,35 m precisam de cadeirinha."
      ]),
      h("Seguro"),
      p("A responsabilidade civil vem incluída em todo aluguel na UE. Danos ao próprio carro costumam ser cobertos por uma CDW com franquia; veja nosso guia sobre CDW, franquia e caução.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Alugar scooter ou quadriciclo na Grécia",
    description: "A habilitação necessária para alugar ciclomotor, scooter ou quadriciclo na Grécia, regras e multas do capacete, falhas do seguro e dicas de segurança nas ilhas.",
    standfirst: "Scooters e quadriciclos estão por toda parte nas ilhas gregas. As regras de habilitação são mais rígidas do que muitos visitantes imaginam.",
    body: [
      h("A habilitação necessária"),
      p("Para alugar um ciclomotor ou scooter na Grécia, você precisa de uma carteira válida com pelo menos a categoria A1 (motocicleta leve). Só a carteira de carro não basta, e a categoria P britânica para ciclomotores de até 50 cc não vale na Grécia. Carteiras provisórias não valem para nenhum veículo."),
      h("Capacete"),
      p("Condutores e passageiros de ciclomotores e quadriciclos devem usar capacete. Se a polícia parar você sem ele, aplicará multa e recolherá sua carteira, e pilotar sem capacete pode invalidar seu seguro."),
      h("Quadriciclos: cuidado redobrado"),
      ul([
        "Quadriciclos causam ferimentos graves e mortes todos os anos. Peça instruções adequadas antes de pilotar e lembre-se de que você divide a estrada com veículos maiores e mais rápidos.",
        "O seguro vendido com quadriciclo geralmente é só contra terceiros: a locadora provavelmente vai cobrar qualquer dano ao próprio quadriciclo.",
        "Muitos seguros viagem tratam quadriciclo como esporte radical e o excluem. Leia sua apólice antes de sair."
      ]),
      h("Na estrada"),
      ul([
        "Na Grécia, dirige-se pela direita.",
        "O trânsito pode ser rápido e caótico, e os motoristas nem sempre param na faixa de pedestres.",
        "Dirigir embriagado é infração grave, com multas e possível prisão."
      ]),
      h("Antes de sair"),
      ul([
        "Confira se o veículo está em bom estado: freios, pneus e luzes.",
        "Fotografe-o com a locadora, incluindo danos já existentes, e combine a caução e o horário de devolução."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Alugar scooter na Tailândia: carteira, capacete e seguro",
    description: "O que você precisa para pilotar legalmente uma scooter alugada na Tailândia: a carteira certa e a PID, regras e multas do capacete, caução e seguro.",
    standfirst: "A scooter é o jeito mais fácil de circular pela maioria das ilhas tailandesas. Veja o que você precisa para pilotar dentro da lei e o que conferir antes de sair.",
    body: [
      h("A habilitação necessária"),
      p("Para pilotar scooter ou moto na Tailândia como visitante, você precisa de uma carteira que cubra motocicletas, mais uma Permissão Internacional para Dirigir (PID) que mostre a categoria de moto. Só a carteira de carro não cobre scooter, não importa o que a loja de aluguel diga."),
      p("O governo tailandês lista as PIDs emitidas pela Convenção de Genebra de 1949, e carteiras de outros países da ASEAN também são aceitas. O governo britânico orienta motoristas britânicos a levar a versão de 1968. Tire sua PID no seu país antes de viajar: não dá para tirar depois de chegar à Tailândia."),
      h("Capacete é lei, para os dois"),
      p("Condutor e passageiro devem usar capacete, segundo a seção 122 da Lei de Trânsito Terrestre (Land Traffic Act). A polícia pode multar em até 2.000 baht, e a fiscalização foi reforçada em todo o país a partir de 1º de junho de 2025. Peça à locadora um capacete do seu tamanho, para você e para quem for na garupa."),
      h("Seguro: o que cobre e o que não cobre"),
      ul([
        "Todo veículo registrado precisa ter o seguro obrigatório (Por Ror Bor). Ele paga por ferimentos e morte, mas não por danos à scooter nem a bens de terceiros.",
        "Pergunte à locadora o que mais o seguro da scooter cobre e quanto você pagaria se ela for danificada ou roubada.",
        "Confira se o seu seguro viagem cobre pilotar moto. Muitas apólices só pagam se você tiver a habilitação certa para o veículo, então pilotar sem ela pode deixar você sem cobertura."
      ]),
      h("Caução"),
      p("Conte com deixar uma caução, devolvida quando você entregar a scooter nas mesmas condições. Não deixe seu passaporte como caução ou garantia: os governos britânico e australiano alertam contra isso. Na Rove, cada veículo mostra a caução antes da reserva."),
      h("Antes de sair"),
      ul([
        "Dê a volta na scooter com a locadora e fotografe arranhões e amassados, para ninguém discutir sobre eles depois.",
        "Confira freios, pneus, luzes e buzina, e se os documentos de registro e do seguro estão com a scooter.",
        "Combine o combustível, o horário de devolução e para quem ligar se ela quebrar.",
        "Salve o telefone ou o chat da locadora antes de sair."
      ]),
      h("Na estrada"),
      ul([
        "Na Tailândia, dirige-se pela esquerda.",
        "A Tailândia tem uma das maiores taxas de mortes no trânsito do mundo, e os motociclistas são os mais expostos. Pilote na defensiva e com cuidado redobrado na chuva.",
        "Feriados como o Songkran trazem mais trânsito e mais bebida. Nunca pilote depois de beber."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Permissão Internacional para Dirigir na Tailândia",
    description: "Você precisa de permissão internacional para dirigir carro ou moto na Tailândia? Qual tipo tirar, onde tirar e o que levar com você.",
    standfirst: "A maioria dos visitantes precisa de uma Permissão Internacional para Dirigir na Tailândia. Veja qual, onde tirar e o que levar.",
    body: [
      h("O que é a PID"),
      p("A Permissão Internacional para Dirigir é uma tradução da sua carteira em formato padrão, reconhecida por acordos internacionais. Ela não substitui sua carteira; você leva as duas sempre que estiver dirigindo."),
      h("Precisa dela na Tailândia?"),
      p("Sim, a menos que você tenha carteira tailandesa ou de outro país da ASEAN. O governo tailandês lista as PIDs emitidas pela Convenção de Genebra de 1949. O governo britânico orienta motoristas britânicos a levar a versão de 1968 para a Tailândia, então confira com o órgão de trânsito do seu país qual tipo ele emite para a Tailândia."),
      p("Sem uma carteira válida, você pode ser multado, e seu seguro viagem pode recusar um pedido de indenização após um acidente. O governo australiano alerta que dirigir sem a habilitação correta pode levar à prisão."),
      h("Scooters e motos"),
      p("Sua PID só cobre o que sua carteira de origem cobre. Para pilotar scooter ou moto, as duas precisam incluir a categoria de motocicleta; carteira e PID só de carro não cobrem scooter."),
      h("Onde tirar"),
      p("A PID é tirada no país que emitiu sua carteira, antes de viajar: não dá para tirar depois de chegar à Tailândia. No Reino Unido, por exemplo, ela é vendida presencialmente em lojas com serviço PayPoint, por £5,50."),
      h("O que levar"),
      ul([
        "Sua carteira definitiva do país de origem (uma carteira digital pode não ser aceita).",
        "Sua PID.",
        "Seu passaporte ou uma cópia, e os documentos do veículo, que a locadora deixa com o veículo."
      ]),
      h("Vai ficar mais tempo?"),
      p("Se você mora na Tailândia, pode solicitar uma carteira tailandesa. O governo tailandês também descreve uma licença temporária de 30 dias para turistas cuja carteira não pode ser usada, emitida pelo Escritório Provincial de Transporte Terrestre.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Aluguel mensal de carro na Tailândia: como funciona",
    description: "Como funciona o aluguel mensal de carro e scooter na Tailândia: custo comparado às diárias, caução, renovação a cada mês e o que conferir.",
    standfirst: "Vai ficar um mês ou mais? Alugar por mês com uma locadora local costuma sair bem mais barato por dia do que alugar por diária.",
    body: [
      h("Por que alugar por mês"),
      p("Locadoras locais na Tailândia costumam ter um preço mensal bem menor por dia do que a diária, porque um aluguel longo poupa entregas, limpeza e dias parados. Se você vai ficar três semanas ou mais, compare os dois antes de reservar."),
      h("Como funciona na Rove"),
      ul([
        "Escolha “Mensal, sem data de término” na busca para ver os preços mensais. Um aluguel mensal sem data de término continua mês a mês até você avisar que vai encerrar.",
        "Escolha uma data de término se souber quando vai embora: a Rove mostra o total exato para suas datas, calculado do jeito que a locadora cobra.",
        "Sua reserva vai direto para a locadora. Ela confirma a entrega com você, e você paga conforme as condições mostradas na página dela."
      ]),
      h("Caução"),
      p("Um aluguel mensal normalmente tem caução, devolvida quando o veículo volta nas mesmas condições. Na Rove, cada veículo mostra a caução antes da reserva. Não deixe seu passaporte como caução: as orientações oficiais de viagem alertam contra isso."),
      h("O que conferir antes de assinar"),
      ul([
        "O que acontece no fim de cada mês: como e quando você paga, e com quanto tempo de antecedência avisar quando quiser encerrar.",
        "O que o seguro do veículo cobre. O seguro obrigatório (Por Ror Bor) só cobre ferimentos e morte, não danos ao veículo.",
        "Quem paga manutenção e consertos durante um aluguel longo, e o que fazer se o veículo quebrar.",
        "Se você pode levar o veículo para fora da ilha ou da província, e se há limite de quilometragem.",
        "Se entrega e retirada estão incluídas."
      ]),
      h("Sua carteira continua importando"),
      p("Visitantes precisam da carteira do país de origem mais uma Permissão Internacional para Dirigir para dirigir na Tailândia. Se você mora na Tailândia, pode solicitar uma carteira tailandesa.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Alugar scooter em Bali",
    description: "O que você precisa para alugar e pilotar scooter em Bali: permissão internacional, capacete, blitz policial, seguro e regras recentes para turistas.",
    standfirst: "Em Bali há scooters por toda parte, e blitz policial também. Veja o que você precisa para pilotar dentro da lei e com segurança.",
    body: [
      h("A habilitação necessária"),
      p("Na Indonésia, a carteira do seu país sozinha não basta: você precisa de uma Permissão Internacional para Dirigir (ou de uma carteira indonésia), e ela precisa cobrir motocicletas. Tire sua PID no seu país antes de viajar."),
      p("A polícia fiscaliza. Em maio de 2025, uma operação de três dias em Badung, que abrange Canggu, Kuta, Seminyak e Uluwatu, autuou 81 condutores, 30 deles turistas, e apreendeu 56 veículos."),
      h("As regras para turistas podem mudar"),
      p("O governo provincial de Bali propôs proibir turistas de estadia curta de alugar motos para pilotar eles mesmos. Na nossa última verificação, era uma proposta, não uma regra em vigor. Pergunte à locadora como está a situação antes de reservar."),
      h("Capacete"),
      p("Use um capacete em bom estado sempre que pilotar, e garanta que o passageiro também tenha um."),
      h("Seguro"),
      p("Confira se o seu seguro viagem cobre pilotar moto na Indonésia com a habilitação que você tem. Pilotar sem a habilitação certa, ou sem seguir as regras, pode fazer um pedido de indenização ser recusado."),
      h("Na estrada"),
      ul([
        "Na Indonésia, dirige-se pela esquerda.",
        "O trânsito é intenso e imprevisível, principalmente no sul. Se você não tem confiança pilotando, um carro com motorista pode ser melhor.",
        "Em caso de acidente, espere a polícia no local e registre a ocorrência numa delegacia.",
        "No Nyepi, o dia do silêncio de Bali, a circulação na ilha para durante o dia todo."
      ]),
      h("Antes de sair"),
      ul([
        "Fotografe a scooter com a locadora, incluindo danos já existentes.",
        "Confira freios, pneus e luzes, e combine caução, combustível e horário de devolução.",
        "Salve o telefone ou o chat da locadora."
      ])
    ]
  }
};

export default pt;
