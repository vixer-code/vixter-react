import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import './ImageEditorModal.css';

const ImageEditorModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  imageFile, 
  imageType = 'avatar', // 'avatar' or 'cover'
  uploading = false 
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [internalUploading, setInternalUploading] = useState(false);

  // Definir aspect ratio baseado no tipo de imagem
  const aspect = imageType === 'avatar' ? 1 : 16 / 9;

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      console.error('Nenhuma área de crop selecionada');
      return;
    }

    setInternalUploading(true);
    try {
      const imageUrl = URL.createObjectURL(imageFile);
      const croppedImageBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      
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
      console.error('Erro ao processar imagem:', error);
    } finally {
      setInternalUploading(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  if (!isOpen || !imageFile) return null;

  const imageUrl = URL.createObjectURL(imageFile);
  const isUploading = uploading || internalUploading;

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
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={true}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '400px',
                    position: 'relative'
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="image-editor-controls">
          <div className="zoom-control">
            <label>Zoom: {Math.round(zoom * 100)}%</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
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

        <div className="image-editor-actions">
          <button 
            className="btn-cancel" 
            onClick={onClose}
            disabled={isUploading}
          >
            Cancelar
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={isUploading || !croppedAreaPixels}
          >
            {isUploading ? (
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