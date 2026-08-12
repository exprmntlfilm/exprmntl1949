# Próximos passos — colocando o CMS no ar

Este pacote é a versão completa: gerador de site (11ty) + as 857 páginas de
conteúdo já convertidas (472 filmes, 380 pessoas, 5 edições) + o painel de
edição (Decap CMS) configurado. O que falta agora são só configurações que
só você pode fazer (contas, nomes de repositório) — nenhuma delas exige
programar.

## 1. Substituir o conteúdo do repositório

No VS Code, dentro da pasta do projeto que já está conectada ao GitHub:

1. Apague tudo que está lá dentro (os arquivos antigos como `films.html`,
   `people.html` não são mais necessários — o 11ty vai gerá-los sozinho)
2. Copie todo o conteúdo deste zip (a pasta `eleventy-site`) para dentro
   dessa mesma pasta do projeto
3. No painel de Source Control, você vai ver uma quantidade grande de
   mudanças (arquivos removidos, centenas adicionados) — é esperado
4. Escreve uma mensagem tipo "Migra para 11ty + CMS" e clica em **Commit**,
   depois em **Sync Changes** (o fluxo de sempre)

## 2. Ativar GitHub Pages via Actions

1. No repositório, vá em **Settings → Pages**
2. Em **"Build and deployment" → Source**, troque de "Deploy from a branch"
   para **"GitHub Actions"**
3. Pronto — o workflow que já está no pacote (`.github/workflows/deploy.yml`)
   assume a partir daqui. Toda vez que algo for enviado ao repositório
   (por você ou pelo CMS), o GitHub constrói o site sozinho e publica.

## 3. Configurar o DecapBridge (login dos arquivistas)

1. Crie uma conta em [decapbridge.com](https://decapbridge.com)
2. Crie um "Site" novo, apontando para o repositório do GitHub
3. O DecapBridge vai te dar um endereço (algo como
   `https://xxxxx.decapbridge.com`) — esse é o `base_url`
4. Abra `admin/config.yml` no seu repositório e substitua as duas linhas
   marcadas `TODO`:
   ```yaml
   backend:
     name: github
     repo: SEU-USUARIO/NOME-DO-REPOSITORIO   # ex: joao/exprmntl-site
     branch: main
     base_url: https://xxxxx.decapbridge.com  # o endereço que o DecapBridge te deu
     auth_endpoint: auth
   ```
5. Salve, commit, sync — o GitHub Actions reconstrói o site com a
   configuração nova
6. De volta no DecapBridge, na aba **"Manage collaborators"** do seu site,
   convide os arquivistas por e-mail — eles não precisam ter conta no GitHub

## 4. Testar

Acesse `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/admin/` — deve
aparecer a tela de login do Decap CMS. Depois de logar, você verá as três
coleções (Filmes, Diretores, Edições) já povoadas com todo o conteúdo atual.

## Se o build falhar

Vá na aba **"Actions"** do repositório no GitHub — cada tentativa de build
aparece ali. Clique na que falhou (ícone vermelho) para ver o log de erro,
e me manda um print. Eu não consegui testar esse build de ponta a ponta no
meu ambiente (sem acesso à internet para instalar o 11ty), então é bem
possível que a primeira tentativa precise de um ajuste — é normal, e
resolvemos do mesmo jeito que resolvemos os outros problemas até aqui.

## O que mudou por baixo dos panos (só por curiosidade)

- Cada filme, diretor e edição agora é um arquivo de texto (`.md`) com os
  dados em formato estruturado (front matter) — é isso que o CMS edita
- O HTML final é sempre *gerado* a partir desses arquivos, nunca editado
  diretamente — significa que o design fica consistente automaticamente
- A busca (`search-data.js`) agora também é gerada automaticamente a cada
  build, sempre em sincronia com o conteúdo real — antes era preciso
  atualizar isso manualmente
- As galerias de fotos não "adivinham mais" nomes de arquivo — o CMS grava
  exatamente quais fotos existem para cada item, o que é mais confiável
