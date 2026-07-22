import { useState } from "react";

export function AboutModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn icon" title="Como funciona o dashboard" aria-label="Como funciona o dashboard"
        onClick={() => setOpen(true)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 16.5v-6M12 7.5h.01" />
        </svg>
      </button>

      {open && (
        <>
          <div className="backdrop modal-backdrop" onClick={() => setOpen(false)} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2>Como o dashboard funciona</h2>
              <button className="btn icon" aria-label="Fechar" onClick={() => setOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <section>
                <h4>De onde vêm os dados</h4>
                <p>
                  O dashboard nunca chama Kommo, Meta Ads ou WhatsApp na hora — um processo
                  automático (sync) busca os dados dessas três fontes periodicamente e grava
                  num banco próprio. As telas só leem esse banco, por isso o carregamento é
                  rápido e não depende das APIs estarem no ar.
                </p>
              </section>

              <section>
                <h4>Frequência de atualização</h4>
                <p>
                  <strong>Kommo</strong> (leads, funil, reuniões) sincroniza a cada <strong>15
                  minutos</strong>. <strong>Meta Ads</strong> (investido) e{" "}
                  <strong>WhatsApp</strong> (tempo de resposta) sincronizam a cada{" "}
                  <strong>2 horas</strong>. Ou seja: o investido de hoje e o tempo de resposta
                  podem ter até ~2h de atraso em relação ao gerenciador da Meta ou ao WhatsApp.
                </p>
              </section>

              <section>
                <h4>Data de criação × data de fechamento</h4>
                <p>
                  "Leads gerados" e as etapas em aberto do funil (Follow up, Agendado) contam
                  pela <strong>data em que o lead entrou</strong>. Já "Ganhos", "Perdidos",
                  receita, ticket médio e tempo de conversão contam pela{" "}
                  <strong>data em que o negócio foi fechado</strong> — igual o filtro
                  "Fechado" do próprio Kommo. Por isso um lead pode aparecer em "Ganhos" hoje
                  mesmo tendo sido criado há semanas.
                </p>
              </section>

              <section>
                <h4>De onde vem cada número</h4>
                <p>
                  <strong>Investido</strong> vem só da Meta Ads. Todo o resto — leads gerados,
                  geração por criativo/campanha e conversão em venda — vem sempre do{" "}
                  <strong>Kommo, pelo UTM</strong> que o lead carrega desde o clique no
                  anúncio. A Meta nunca conta como fonte de lead, só de gasto.
                </p>
              </section>

              <section>
                <h4>Como as reuniões são contadas</h4>
                <p>
                  Não existe um botão de "reunião realizada" — o sistema interpreta pelo
                  movimento do card no Kommo. Sair da etapa Agendado para uma etapa seguinte
                  conta como <strong>realizada</strong>; ir para No-show ou Cancelado conta
                  como <strong>cancelada</strong>; voltar para Agendado conta como{" "}
                  <strong>remarcada</strong>. Se o comercial não mover o card, a reunião não é
                  contabilizada.
                </p>
              </section>

              <section>
                <h4>Tempo de resposta</h4>
                <p>
                  Só conta como resposta se o time respondeu em até <strong>12 horas</strong>{" "}
                  após a mensagem do lead. Gaps maiores são ignorados — não é resposta real,
                  provavelmente o lead sumiu e voltou depois.
                </p>
              </section>

              <section>
                <h4>Fuso horário</h4>
                <p>Todos os filtros de data ("Hoje", "Ontem" etc.) usam o horário de Brasília.</p>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
