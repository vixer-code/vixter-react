export default function getCroppedImg(imageSrc, crop, rotation = 0) {
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

      // Definir tamanho do canvas baseado no crop
      canvas.width = crop.width;
      canvas.height = crop.height;

      // Aplicar rotação se necessário
      if (rotation !== 0) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      // Desenhar a imagem na área de crop
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
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
