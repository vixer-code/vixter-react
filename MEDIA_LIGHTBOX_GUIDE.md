# MediaLightbox - Guia de Implementação

## Visão Geral

O `MediaLightbox` é um componente modal/lightbox responsivo para visualização de mídias (imagens e vídeos) com funcionalidades avançadas de zoom, pan e navegação.

## Componentes Disponíveis

### 1. MediaLightbox
Componente padrão para mídias com URLs diretas ou R2MediaViewer.

### 2. SecureMediaLightbox  
Componente especializado para mídias com autenticação JWT (usado no PackContentViewer).

## Funcionalidades Implementadas

### ✅ Modal Centralizado em Tela Cheia
- Fundo escuro translúcido com blur
- Modal responsivo que se adapta a diferentes tamanhos de tela
- Animação suave de entrada/saída

### ✅ Navegação
- Botões de navegação (próximo/anterior)
- Suporte a teclado (setas esquerda/direita)
- Contador de itens (ex: "2 / 5")
- Navegação circular (volta ao início no final)

### ✅ Zoom e Pan
- **Desktop**: Scroll do mouse para zoom (+/-), arrastar para pan
- **Mobile**: Pinch-to-zoom, arrastar com um dedo para pan
- Botões de controle de zoom (+/-/reset)
- Indicador visual do nível de zoom
- Zoom máximo de 500% e mínimo de 50%

### ✅ Proteções de Segurança
- Bloqueio do menu de contexto (clique direito)
- Prevenção de drag & drop
- Desabilitação de seleção de texto
- Controles de vídeo protegidos (sem download, fullscreen, etc.)

### ✅ Suporte a Vídeos
- Controles nativos de play/pause
- Botão de toggle centralizado
- Mesmas proteções de segurança das imagens
- Integração com R2MediaViewer

### ✅ Marca D'água
- Mantém todas as proteções existentes do R2MediaViewer
- Marca d'água personalizada continua sendo exibida
- Suporte a diferentes tipos de mídia (pack/service)

### ✅ Design Responsivo
- Adaptação automática para mobile/tablet/desktop
- Controles otimizados para touch
- Instruções contextuais
- Suporte a modo de alto contraste

## Como Usar

### 1. Importação

#### Para mídias padrão:
```jsx
import MediaLightbox from '../components/MediaLightbox';
```

#### Para mídias com autenticação JWT:
```jsx
import SecureMediaLightbox from '../components/SecureMediaLightbox';
```

### 2. Estados Necessários
```jsx
const [showLightbox, setShowLightbox] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);
const [lightboxItems, setLightboxItems] = useState([]);
```

### 3. Função para Abrir o Lightbox
```jsx
const handleOpenLightbox = (index, mediaType) => {
  if (!pack) return;
  
  let items = [];
  
  if (mediaType === 'images' && pack.sampleImages) {
    items = pack.sampleImages.map(img => ({
      key: img.key,
      type: 'image',
      url: null
    }));
  } else if (mediaType === 'videos' && pack.sampleVideos) {
    items = pack.sampleVideos.map(video => ({
      key: video.key,
      type: 'video',
      url: null
    }));
  }
  
  if (items.length > 0) {
    setLightboxItems(items);
    setLightboxIndex(index);
    setShowLightbox(true);
  }
};
```

### 4. Modificar a Vitrine
```jsx
// Para imagens
<div 
  className="showcase-item"
  onClick={() => handleOpenLightbox(index, 'images')}
  style={{ cursor: 'pointer' }}
>
  <R2MediaViewer
    mediaKey={image.key}
    type="pack"
    watermarked={false}
    alt={`${pack.title} - Amostra ${index + 1}`}
    className="showcase-media"
  />
  <div className="showcase-overlay">
    <i className="fas fa-expand-arrows-alt"></i>
  </div>
</div>
```

### 5. Renderizar o Componente
```jsx
<MediaLightbox
  isOpen={showLightbox}
  onClose={() => setShowLightbox(false)}
  mediaItems={lightboxItems}
  currentIndex={lightboxIndex}
  type="pack"
  watermarked={false}
  isOwner={false}
/>
```

## Props do Componente

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `isOpen` | boolean | - | Controla se o modal está aberto |
| `onClose` | function | - | Função chamada ao fechar o modal |
| `mediaItems` | array | [] | Array de itens de mídia |
| `currentIndex` | number | 0 | Índice do item atual |
| `type` | string | 'pack' | Tipo de mídia ('pack' ou 'service') |
| `watermarked` | boolean | false | Se deve aplicar marca d'água |
| `isOwner` | boolean | false | Se o usuário é dono do conteúdo |

## Formato dos MediaItems

```jsx
const mediaItems = [
  {
    key: 'path/to/media.jpg', // Chave do R2MediaViewer
    type: 'image', // 'image' ou 'video'
    url: null // URL alternativa (opcional)
  }
];
```

## Atalhos de Teclado

- `ESC`: Fechar modal
- `←`: Item anterior
- `→`: Próximo item
- `+` ou `=`: Zoom in
- `-`: Zoom out
- `0`: Reset zoom

## Estilos CSS Adicionais

O componente inclui estilos responsivos que se adaptam automaticamente:

- **Desktop**: Controles completos, hover effects
- **Tablet**: Controles otimizados para touch
- **Mobile**: Interface simplificada, gestos touch

## Integração com R2MediaViewer

O MediaLightbox é totalmente compatível com o sistema existente:

- Mantém todas as proteções de segurança
- Suporta marca d'água personalizada
- Funciona com URLs assinadas do R2
- Preserva controles de vídeo protegidos

## Implementações Existentes

### 1. PackContentViewer (My Purchases)
- **Arquivo**: `src/components/PackContentViewer.jsx`
- **Componente**: `SecureMediaLightbox`
- **Funcionalidade**: Vitrine de conteúdo comprado com autenticação JWT
- **Acesso**: `/my-purchases` → Clicar em "Visualizar Conteúdo" em um pack comprado

### 2. PackDetail (Vitrine de Amostras)
- **Arquivo**: `src/pages/PackDetail.jsx` 
- **Componente**: `MediaLightbox` (pronto para uso)
- **Funcionalidade**: Vitrine de amostras antes da compra
- **Status**: Componente criado, mas não integrado (conforme solicitado)

## Exemplo de Implementação

### Para PackDetail (quando necessário):
```jsx
// No PackDetail.jsx
import MediaLightbox from '../components/MediaLightbox';

// Estados
const [showLightbox, setShowLightbox] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);
const [lightboxItems, setLightboxItems] = useState([]);

// Função para abrir lightbox
const handleOpenLightbox = (index, mediaType) => {
  // Lógica para preparar items...
  setLightboxIndex(index);
  setShowLightbox(true);
};

// No JSX
<MediaLightbox
  isOpen={showLightbox}
  onClose={() => setShowLightbox(false)}
  mediaItems={lightboxItems}
  currentIndex={lightboxIndex}
  type="pack"
  watermarked={false}
  isOwner={false}
/>
```
