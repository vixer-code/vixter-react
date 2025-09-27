import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageEditorModal.css';

const ImageEditorModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  imageFile, 
  imageType = 'avatar', // 'avatar' or 'cover'
  uploading = false 
}) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [aspect, setAspect] = useState(imageType === 'avatar' ? 1 : 16/9);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setScale(1);
      setRotate(0);
      setAspect(imageType === 'avatar' ? 1 : 16/9);
      setImagePosition({ x: 0, y: 0 });
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
    }
  }, [isOpen, imageType]);

  // Função para criar crop que ocupa toda a área
  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    
    // Criar crop que ocupa toda a área disponível
    const crop = {
      unit: 'px',
      x: 0,
      y: 0,
      width: width,
      height: height
    };
    
    setCrop(crop);
    setCompletedCrop(crop);
  }, []);

  // Funções para drag da imagem
  const handleMouseDown = useCallback((e) => {
    if (!crop) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    });
    e.preventDefault();
  }, [crop, imagePosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !crop) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setImagePosition({ x: newX, y: newY });
  }, [isDragging, dragStart, crop]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Adicionar event listeners para drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Função para converter canvas para blob
  const getCroppedImg = (canvas, crop) => {
    return new Promise((resolve) => {
      // Verificar se o canvas tem dimensões válidas
      if (canvas.width <= 0 || canvas.height <= 0) {
        console.error('Canvas has invalid dimensions:', canvas.width, canvas.height);
        resolve(null);
        return;
      }

      // Verificar se o canvas tem conteúdo
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('No 2d context available');
        resolve(null);
        return;
      }

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((pixel, index) => {
          // Verificar se há pixels não transparentes (ignorando canal alpha)
          return index % 4 !== 3 && pixel !== 0;
        });

        if (!hasContent) {
          console.error('Canvas is empty or black');
          resolve(null);
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.error('Failed to create blob from canvas');
              resolve(null);
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          0.9
        );
      } catch (error) {
        console.error('Error getting image data:', error);
        resolve(null);
      }
    });
  };

  // Função para salvar a imagem editada
  const handleSave = async () => {
    if (!crop || !imgRef.current) {
      return;
    }

    setUploading(true);
    try {
      // Criar canvas para processar a imagem com a posição atual
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const image = imgRef.current;

      if (!ctx) {
        throw new Error('No 2d context');
      }

      // Definir tamanho do canvas baseado no crop
      canvas.width = crop.width;
      canvas.height = crop.height;

      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Desenhar a imagem na posição correta
      ctx.drawImage(
        image,
        -imagePosition.x,
        -imagePosition.y,
        image.naturalWidth,
        image.naturalHeight
      );

      const croppedImageBlob = await getCroppedImg(canvas, crop);
      if (croppedImageBlob) {
        // Criar um novo File object com o blob
        const croppedImageFile = new File([croppedImageBlob], imageFile.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        
        onSave(croppedImageFile);
        onClose();
      }
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setUploading(false);
    }
  };

  // Função para resetar as configurações
  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      onImageLoad({ currentTarget: imgRef.current });
    }
  };

  if (!isOpen || !imageFile) return null;

  const imageUrl = URL.createObjectURL(imageFile);

  return (
    <div className="image-editor-modal-overlay" onClick={onClose}>
      <div className="image-editor-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-editor-header">
          <h3>Editar {imageType === 'avatar' ? 'Foto de Perfil' : 'Foto de Capa'}</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="image-editor-body">
          <div className="image-editor-main">
            <div className="crop-container">
              <ReactCrop
                crop={crop}
                onChange={() => {}} // Desabilitar mudanças no crop
                onComplete={() => {}} // Desabilitar mudanças no crop
                minWidth={50}
                minHeight={50}
                keepSelection={true}
                circularCrop={imageType === 'avatar'}
                disabled={true} // Desabilitar interação com crop
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imageUrl}
                  style={{ 
                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${scale}) rotate(${rotate}deg)`,
                    maxWidth: '100%',
                    maxHeight: '400px',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none'
                  }}
                  onLoad={onImageLoad}
                  onMouseDown={handleMouseDown}
                  draggable={false}
                />
              </ReactCrop>
            </div>

          </div>

        </div>

        <div className="image-editor-actions">
          <button 
            className="btn-cancel" 
            onClick={onClose}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={uploading || !crop}
          >
            {uploading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Salvando...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;
