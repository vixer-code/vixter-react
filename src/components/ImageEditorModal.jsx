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
  const previewCanvasRef = useRef(null);

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
          width: 90,
        },
        cropAspect,
        width,
        height
      ),
      width,
      height
    );
    
    setCrop(crop);
  }, [imageType]);

  // Função para gerar preview da imagem cortada
  const generatePreview = useCallback(() => {
    if (!completedCrop || !imgRef.current || !previewCanvasRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    // Definir tamanho do canvas baseado no crop
    const cropWidth = Math.floor(completedCrop.width * scaleX * pixelRatio);
    const cropHeight = Math.floor(completedCrop.height * scaleY * pixelRatio);
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    // Limpar o canvas
    ctx.clearRect(0, 0, cropWidth, cropHeight);

    // Aplicar transformações
    ctx.save();
    ctx.translate(-completedCrop.x * scaleX, -completedCrop.y * scaleY);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    
    // Desenhar a imagem
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight
    );
    ctx.restore();
  }, [completedCrop, scale, rotate]);

  // Atualizar preview quando o crop ou outras propriedades mudarem
  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  // Função para converter canvas para blob
  const getCroppedImg = (canvas, crop) => {
    return new Promise((resolve) => {
      // Verificar se o canvas tem conteúdo
      const ctx = canvas.getContext('2d');
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
    });
  };

  // Função para salvar a imagem editada
  const handleSave = async () => {
    if (!completedCrop || !previewCanvasRef.current) {
      return;
    }

    try {
      const canvas = previewCanvasRef.current;
      const croppedImageBlob = await getCroppedImg(canvas, completedCrop);
      
      if (!croppedImageBlob) {
        console.error('Failed to generate cropped image');
        return;
      }
      
      // Criar um novo File object com o blob
      const croppedImageFile = new File([croppedImageBlob], imageFile.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      onSave(croppedImageFile);
    } catch (error) {
      console.error('Error processing image:', error);
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
                keepSelection
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
                />
                <span>{rotate}°</span>
              </div>

              <div className="control-group">
                <label>Proporção:</label>
                <select 
                  value={aspect} 
                  onChange={(e) => setAspect(Number(e.target.value))}
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
              >
                <i className="fas fa-undo"></i>
                Resetar
              </button>
            </div>
          </div>

          <div className="preview-section">
            <h4>Pré-visualização</h4>
            <div className={`preview-container ${imageType}`}>
              {imageType === 'avatar' ? (
                <div className="avatar-preview">
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              ) : (
                <div className="cover-preview">
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              )}
            </div>
            <p className="preview-note">
              Esta é uma pré-visualização de como sua {imageType === 'avatar' ? 'foto de perfil' : 'foto de capa'} aparecerá.
            </p>
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
            disabled={uploading || !completedCrop}
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
