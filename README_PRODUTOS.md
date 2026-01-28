# Editor de Produtos - Cangaço

Sistema para gerenciar produtos do site através de arquivos JSON e scripts Python.

## Arquivos

- `produtos.json` - Arquivo JSON contendo todos os produtos
- `editar_produtos.py` - Script interativo para editar produtos
- `gerar_html_produtos.py` - Script para gerar HTML a partir do JSON

## Como Usar

### 1. Editar Produtos

Execute o script interativo:

```bash
python editar_produtos.py
```

O menu oferece as seguintes opções:

1. **Listar produtos** - Mostra todos os produtos cadastrados
2. **Adicionar produto** - Adiciona um novo produto ao catálogo
3. **Editar produto** - Edita um produto existente pelo ID
4. **Remover produto** - Remove um produto do catálogo
5. **Sair** - Encerra o programa

### 2. Gerar HTML

Após editar os produtos no JSON, você pode gerar o HTML:

```bash
python gerar_html_produtos.py
```

Isso criará um arquivo `produtos_html_gerado.txt` com:
- A seção de produtos (grid)
- A seção de modais

Você pode copiar esse conteúdo e colar no arquivo `produtos.html`.

## Estrutura do JSON

Cada produto possui:

```json
{
  "id": 1,
  "imagem": "img/logocacto.svg",
  "alt": "Castanha de Caju",
  "titulo": "Castanha de Caju - 250g",
  "descricao": "Selecionada e torrada artesanalmente...",
  "preco": "R$ 25,90",
  "modal": {
    "id": "modal-1",
    "imagem": "url_da_imagem",
    "alt": "Castanha de Caju - Fardo",
    "titulo": "Castanha de Caju - Fardo",
    "descricao": "Fardo com 12 unidades de 200g cada",
    "preco": "R$ 280,00",
    "whatsapp_texto": "Olá! Gostaria de comprar...",
    "whatsapp_numero": "5511999999999"
  }
}
```

## Exemplo de Uso

### Adicionar um novo produto:

1. Execute `python editar_produtos.py`
2. Escolha a opção 2 (Adicionar produto)
3. Preencha as informações solicitadas
4. O produto será salvo automaticamente no `produtos.json`

### Editar um produto existente:

1. Execute `python editar_produtos.py`
2. Escolha a opção 1 para ver a lista de produtos e seus IDs
3. Escolha a opção 3 (Editar produto)
4. Digite o ID do produto
5. Edite os campos desejados (pressione Enter para manter valores atuais)
6. As alterações serão salvas automaticamente

### Atualizar o HTML do site:

1. Edite os produtos usando `editar_produtos.py`
2. Execute `python gerar_html_produtos.py`
3. Abra `produtos_html_gerado.txt`
4. Copie a seção de produtos e modais
5. Cole no arquivo `produtos.html` substituindo as seções correspondentes

## Requisitos

- Python 3.6 ou superior
- Nenhuma biblioteca externa necessária (usa apenas bibliotecas padrão)

## Notas

- O arquivo `produtos.json` é criado automaticamente se não existir
- Todos os IDs são gerados automaticamente
- O script valida os dados antes de salvar
- O HTML gerado segue o padrão do site atual
