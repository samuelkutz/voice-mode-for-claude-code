/**
 * The message a Claude Code session receives for a spoken request. It carries
 * the request and the rules for answering in the document thread, written to
 * be read aloud by voice mode.
 */
export function workerPrompt({ docId, rootId, body, followUp = false, note = "" }) {
  const intro = followUp
    ? "Nova mensagem do Samuel no mesmo tópico do documento, falada no voice mode do Claude no celular. Se for uma resposta curta, como \"opção um\", ela responde à última pergunta que você fez."
    : "Pedido do Samuel, falado no voice mode do Claude no celular e transcrito como comentário num Claude Doc.";

  return `${intro}${note ? `\n\nObservação do vigia: ${note}` : ""}

Mensagem:
"""
${body}
"""

Como responder (obrigatório):
- Faça o trabalho. Você roda em modo auto; git push e gh pr estão proibidos. Faça commit local se precisar e diga que o push fica com o Samuel.
- Ao terminar, ou quando precisar de uma decisão, responda no tópico do documento chamando a ferramenta create do conector Claude Docs, com exatamente esta forma:
  create(object="utterance", container={"kind":"project","id":"${docId}"}, payload={"value":{"body":"<sua resposta>","parent":{"object":"utterance","id":"${rootId}"}}})
  Não inclua o campo "to" na resposta.
- Tudo que você postar será lido em voz alta. Sem markdown, código, tabela, lista ou caminho completo; arquivo só pelo nome.
- Andamento: ao começar e a cada mudança de fase (por exemplo lendo o código, editando, rodando os testes), poste no mesmo tópico um comentário de uma frase começando com "Andamento:". No máximo um a cada poucos minutos e no máximo seis no total; não poste andamento para tarefas de menos de um minuto. Se delegar trabalho a subagentes, diga no andamento o que eles estão fazendo; só você posta no documento.
- Resposta final: comece com "Terminei." e diga em três partes o que fez, o resultado, e se precisa do Samuel. No máximo cinco frases.
- Se precisar de uma decisão, pergunte uma por vez, neste formato falado: "Preciso de uma decisão sua. A pergunta é: ... Eu recomendo a opção um, porque ... Opção um, a recomendada: ... Opção dois, a mínima: ... Opção três, a completa: ... Opção quatro, a alternativa: ... Responda com o número, ou com as suas palavras." Depois poste e pare; a resposta do Samuel chega como nova mensagem nesta sessão.
- Detalhe técnico fica aqui na sessão, não no comentário.`;
}
