# voice-mode-for-claude-code

Ponte de voz entre o voice mode do Claude no Android e o Claude Code no PC.

O voice mode deixa um pedido como comentário num documento do claude.ai
chamado "voice-mode-for-claude-code". Um vigia no PC, disparado pelo Agendador
de Tarefas do Windows, lê os comentários novos com um `claude -p` enxuto
(Haiku) e entrega cada pedido a uma sessão do Claude Code: uma sessão nova em
segundo plano (`claude --bg`), ou a sessão citada pelo nome, pelo named pipe
dela. A sessão responde no mesmo tópico, num formato feito para ser ouvido, e o
voice mode lê a resposta em voz alta.

Tudo passa pelo claude.ai: não há túnel, servidor público nem porta aberta no PC.

Estado: desenho fechado, implementação ainda não começou.

Uso e instalação: [INSTALL.md](INSTALL.md).
