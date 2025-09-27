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
  const imgRef = useRef(null);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setScale(1);
      setRotate(0);
      setAspect(imageType === 'avatar' ? 1 : 16/9);
    }
  }, [isOpen, imageType]);

  // Função para criar crop centralizado
  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    
    // Definir aspect ratio baseado no tipo de imagem
    const cropAspect = imageType === 'avatar' ? 1 : 16/9;
    
    // Criar crop centralizado
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 80, // Reduzido de 90% para 80% para dar mais espaço
        },
        cropAspect,
        width,
        height
      ),
      width,
      height
    );
    
    setCrop(crop);
    setCompletedCrop(crop); // Definir completedCrop inicial
  }, [imageType]);


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
      const croppedImageBlob = await getCroppedImg(imgRef.current, crop, scale, rotate);
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
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                minWidth={50}
                minHeight={50}
                keepSelection={true}
                circularCrop={imageType === 'avatar'}
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imageUrl}
                  style={{ 
                    transform: `scale(${scale}) rotate(${rotate}deg)`,
                    maxWidth: '100%',
                    maxHeight: '400px'
                  }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>

            <div className="image-controls">
              <div className="control-group">
                <label>Zoom:</label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  disabled={!crop}
                />
                <span>{Math.round(scale * 100)}%</span>
              </div>

              <div className="control-group">
                <label>Rotacionar:</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotate}
                  onChange={(e) => setRotate(Number(e.target.value))}
                  disabled={!crop}
                />
                <span>{rotate}°</span>
              </div>

              <div className="control-group">
                <label>Proporção:</label>
                <select 
                  value={aspect} 
                  onChange={(e) => setAspect(Number(e.target.value))}
                  disabled={!crop}
                >
                  <option value={1}>1:1 (Quadrado)</option>
                  <option value={16/9}>16:9 (Widescreen)</option>
                  <option value={4/3}>4:3 (Padrão)</option>
                  <option value={3/2}>3:2 (Fotografia)</option>
                </select>
              </div>

              <button 
                className="reset-btn" 
                onClick={handleReset}
                type="button"
                disabled={!crop}
              >
                <i className="fas fa-undo"></i>
                Resetar
              </button>
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
