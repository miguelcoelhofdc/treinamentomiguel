# Sincronização do Meu Ritmo

1. No projeto Supabase destinado ao Meu Ritmo, execute `training_sync.sql` no editor SQL. A tabela usa PostgreSQL com acesso restrito ao servidor.
2. No projeto Vercel do app, configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY` no ambiente de produção. Use a chave de servidor `sb_secret_` da Data API.
3. Configure `TRAINING_SESSION_SECRET`, `TRAINING_MIGUEL_PASSWORD` e `TRAINING_SINTIA_PASSWORD` na Vercel. As senhas dão acesso aos mesmos perfis em qualquer aparelho.
4. Publique a versão e valide o acesso de cada perfil. Em um navegador de teste, grave uma avaliação e confirme que ela aparece em outro navegador conectado ao mesmo perfil.

Para migrar o histórico antigo, abra o mesmo endereço do app na instalação ou no navegador do celular onde você fez os registros e entre no mesmo perfil com a senha. O envio começa automaticamente. Em **Ajustes → Dados e backup**, aguarde **Sincronizado com a nuvem** antes de limpar os dados do navegador ou trocar de aparelho. Se houver registros em outras instalações ou navegadores, abra o app em cada um para enviar o histórico local daquele aparelho.
