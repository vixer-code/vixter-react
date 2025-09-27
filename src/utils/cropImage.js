export default function getCroppedImg(imageSrc, crop, rotation = 0, outputSize = null) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      // Usar tamanho de saída se fornecido, senão usar tamanho do crop
      const finalWidth = outputSize ? outputSize.width : crop.width;
      const finalHeight = outputSize ? outputSize.height : crop.height;
      
      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Configurar qualidade de renderização
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Aplicar rotação se necessário
      if (rotation !== 0) {
        const centerX = finalWidth / 2;
        const centerY = finalHeight / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      // Desenhar a imagem na área de crop com redimensionamento se necessário
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        finalWidth,
        finalHeight
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas está vazio'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.9
      );
    };

    image.onerror = (error) => reject(error);
  });
}
