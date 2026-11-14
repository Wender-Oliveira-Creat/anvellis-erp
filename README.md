# Anvellis | Sistema de Gestão de Estoque e Vendas

A **Anvellis** é um sistema de gestão desenvolvido para auxiliar microempreendedores do setor de joias e acessórios na organização de suas operações comerciais.

O projeto foi desenvolvido durante o segundo período do curso de **Sistemas de Informação**, como parte do Projeto Integrador, com o objetivo de aplicar conhecimentos de programação, desenvolvimento web, banco de dados e integração entre frontend e backend.

## Sobre o projeto

A Anvellis surgiu da necessidade de oferecer uma solução simples e organizada para o gerenciamento de produtos, estoque e vendas de uma microempresa.

O sistema reúne funcionalidades administrativas em uma interface web, permitindo que o usuário gerencie informações essenciais para o funcionamento do negócio.

## Tecnologias utilizadas

**Backend**
- Python
- Flask
- Flask-CORS
- API REST

**Frontend**
- HTML5
- CSS3
- JavaScript

**Banco de dados**
- SQLite
- Biblioteca `sqlite3` do Python

**Ferramentas**
- Git e GitHub
- Visual Studio Code

## Funcionalidades

- Cadastro e autenticação de usuários
- Recuperação de senha por e-mail
- Cadastro e gerenciamento de produtos
- Controle de estoque
- Gerenciamento de vendas
- Dashboard administrativo
- Integração entre frontend e backend por meio de API REST

## Arquitetura do sistema

A Anvellis utiliza uma arquitetura com frontend e backend separados, conectados por uma API REST desenvolvida com Flask.

O funcionamento ocorre da seguinte maneira:

1. O usuário interage com a interface web.
2. O JavaScript realiza validações iniciais e envia requisições HTTP para a API.
3. O Flask recebe as requisições e aciona as funções Python.
4. O backend executa as validações e regras de negócio.
5. Quando necessário, o backend realiza operações no banco de dados SQLite.
6. A API retorna uma resposta HTTP, geralmente em JSON, para o frontend.

**Fluxo simplificado:**

`Frontend → API Flask → Backend Python → SQLite`

O resultado das operações retorna pelo backend e pela API até a interface do usuário.

## Recuperação de senha

O sistema possui uma funcionalidade de recuperação de senha por e-mail.

O processo utiliza:

- **Flask:** disponibilização dos endpoints de recuperação e redefinição.
- **itsdangerous:** geração e validação de tokens assinados com validade de 15 minutos.
- **smtplib:** envio de mensagens por meio do protocolo SMTP.
- **Werkzeug:** geração de hash para armazenamento seguro das novas senhas.

As credenciais de envio de e-mail são configuradas por variáveis de ambiente.

## Estrutura do projeto

```text
anvellis-erp/
├── BACKEND/
│   ├── app.py
│   ├── banco.py
│   ├── produto.py
│   └── usuario.py
├── FRONTEND/
│   ├── CSS/
│   ├── Img/
│   ├── JS/
│   ├── index.html
│   ├── cadastro.html
│   ├── dashboard.html
│   ├── produtos.html
│   ├── estoque.html
│   ├── vendas.html
│   └── redefinir-senha.html
├── .gitignore
└── README.md
```

## Como executar localmente

**Pré-requisitos:** Python 3 e um navegador web.

**1. Clone o repositório:**

```bash
git clone https://github.com/Wender-Oliveira-Creat/anvellis-erp.git
```

**2. Acesse a pasta:**

```bash
cd anvellis-erp
```

**3. Instale as dependências:**

```bash
python -m pip install flask flask-cors itsdangerous werkzeug
```

**4. Inicie o backend:**

```bash
python BACKEND/app.py
```

A API estará disponível, por padrão, em:

`http://127.0.0.1:5000`

**5. Execute o frontend:**

Utilize um servidor local, como o Live Server do VS Code, para abrir `FRONTEND/index.html` na porta 5500.

**Observação:** o envio de e-mails para recuperação de senha exige configuração adicional de SMTP. O projeto está preparado para execução em ambiente de desenvolvimento local.

## Minha contribuição

Minha principal atuação no projeto foi no **desenvolvimento do backend em Python**, incluindo:

- Implementação de funções e validações.
- Desenvolvimento de endpoints com Flask.
- Integração com o banco SQLite.
- Implementação da recuperação de senha por e-mail.
- Integração das funcionalidades do backend com o frontend.
- Participação na apresentação técnica do projeto.

O desenvolvimento foi realizado em equipe, com contribuições dos demais integrantes nas diferentes etapas do sistema.

## Equipe e créditos

Projeto acadêmico desenvolvido em equipe no curso de Sistemas de Informação.

O histórico de commits e os colaboradores do repositório original foram preservados nesta versão de portfólio.

**Repositório original:** [PI-2s](https://github.com/lararsouza-1/PI-2s)

## Próximas melhorias

- Hospedagem da aplicação em ambiente online.
- Banco de dados centralizado para acesso por diferentes dispositivos.
- Implementação de backups.
- Melhorias de segurança e autenticação.
- Testes automatizados.
- Aprimoramento da interface e experiência do usuário.

---

**Anvellis — Projeto Integrador | Sistemas de Informação**

Desenvolvido para aplicar conhecimentos acadêmicos na construção de uma solução real de gestão empresarial.
