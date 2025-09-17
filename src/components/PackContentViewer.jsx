import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSecurePackContent } from '../hooks/useSecurePackContent';
import './PackContentViewer.css';

const PackContentViewer = ({ pack, orderId, vendorInfo, onClose }) => {
  const { currentUser } = useAuth();
  const { generateSecurePackContentUrl, openSecureContent } = useSecurePackContent();
  
  const [contentUrls, setContentUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  // Generate secure URL for a specific content item
  const generateContentUrl = useCallback(async (contentItem) => {
    if (!contentItem.key || !currentUser?.uid || !pack?.id) {
      return null;
    }

    try {
      setLoading(prev => ({ ...prev, [contentItem.key]: true }));
      
      const result = await generateSecurePackContentUrl(
        contentItem.key,
        pack.id,
        orderId,
        currentUser.email?.split('@')[0] || 'user'
      );
      
      setContentUrls(prev => ({
        ...prev,
        [contentItem.key]: result.url
      }));
      
      return result.url;
    } catch (err) {
      console.error('Error generating content URL:', err);
      setError(`Erro ao carregar ${contentItem.name}: ${err.message}`);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [contentItem.key]: false }));
    }
  }, [generateSecurePackContentUrl, currentUser?.uid, pack?.id, orderId]);

  // Generate URLs for all content items
  const generateAllUrls = useCallback(async () => {
    if (!pack?.packContent || !Array.isArray(pack.packContent)) {
      return;
    }

    const promises = pack.packContent.map(async (contentItem) => {
      if (contentItem.key) {
        await generateContentUrl(contentItem);
      }
    });

    await Promise.all(promises);
  }, [pack?.packContent, generateContentUrl]);

  useEffect(() => {
    generateAllUrls();
  }, [generateAllUrls]);

  const handleContentClick = async (contentItem) => {
    if (!contentItem.key) return;

    try {
      // Use the new secure content opening method
      await openSecureContent(
        contentItem.key,
        pack.id,
        orderId,
        currentUser.email?.split('@')[0] || 'user'
      );
    } catch (err) {
      console.error('Error opening secure content:', err);
      setError(`Erro ao abrir ${contentItem.name}: ${err.message}`);
    }
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) {
      return 'fas fa-image';
    } else if (type.startsWith('video/')) {
      return 'fas fa-video';
    } else if (type.includes('pdf')) {
      return 'fas fa-file-pdf';
    } else if (type.includes('zip') || type.includes('rar')) {
      return 'fas fa-file-archive';
    } else {
      return 'fas fa-file';
    }
  };

  const getFileTypeLabel = (type) => {
    if (type.startsWith('image/')) {
      return 'Imagem';
    } else if (type.startsWith('video/')) {
      return 'Vídeo';
    } else if (type.includes('pdf')) {
      return 'PDF';
    } else if (type.includes('zip') || type.includes('rar')) {
      return 'Arquivo';
    } else {
      return 'Arquivo';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!pack) {
    return (
      <div className="pack-content-viewer">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Pack não encontrado</h3>
          <p>O pack solicitado não foi encontrado ou não está mais disponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pack-content-viewer">
      <div className="viewer-header">
        <div className="pack-info">
          <h2>{pack.title}</h2>
          <p className="pack-description">{pack.description}</p>
          <div className="pack-meta">
            <span className="category">{pack.category}</span>
            <span className="item-count">
              {pack.packContent?.length || 0} itens
            </span>
            {vendorInfo && (
              <span className="vendor-info">
                <i className="fas fa-user"></i>
                Vendido por: 
                <a 
                  href={`https://vixter.com.br/profile/${vendorInfo.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vendor-link"
                >
                  {vendorInfo.name} (@{vendorInfo.username})
                </a>
              </span>
            )}
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="viewer-content">
            <div className="content-warning">
              <i className="fas fa-shield-alt"></i>
              <div className="warning-content">
                <p>
                  <strong>Visualização Segura:</strong> Este conteúdo é protegido por watermark 
                  personalizado com seu username. Compartilhar URLs resultará em acesso negado.
                </p>
                <p className="watermark-info">
                  <i className="fas fa-info-circle"></i>
                  <strong>Watermark:</strong> Todas as mídias (imagens e vídeos) exibem seu username ({currentUser?.email?.split('@')[0] || 'usuário'}) 
                  para proteção contra compartilhamento não autorizado.
                </p>
                <p className="video-info">
                  <i className="fas fa-video"></i>
                  <strong>Vídeos:</strong> O processamento de vídeos pode levar alguns segundos para aplicar o watermark. 
                  Por favor, aguarde o carregamento.
                </p>
              </div>
            </div>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="content-grid">
          {pack.packContent?.map((contentItem, index) => (
            <div
              key={contentItem.key || index}
              className="content-item"
              onClick={() => handleContentClick(contentItem)}
            >
              <div className="content-preview">
                {loading[contentItem.key] ? (
                  <div className="loading-spinner">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                ) : contentUrls[contentItem.key] ? (
                  <div className="preview-loaded">
                    <i className={getFileIcon(contentItem.type)}></i>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <i className={getFileIcon(contentItem.type)}></i>
                  </div>
                )}
              </div>
              
              <div className="content-info">
                <h4 className="content-name">{contentItem.name}</h4>
                <div className="content-meta">
                  <span className="file-type">{contentItem.type}</span>
                  {contentItem.size && (
                    <span className="file-size">{formatFileSize(contentItem.size)}</span>
                  )}
                </div>
              </div>

              <div className="content-actions">
                <button
                  className="view-btn"
                  disabled={loading[contentItem.key] || !contentUrls[contentItem.key]}
                >
                  <i className="fas fa-eye"></i>
                  {loading[contentItem.key] ? 'Carregando...' : 'Visualizar'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {(!pack.packContent || pack.packContent.length === 0) && (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>Nenhum conteúdo disponível</h3>
            <p>Este pack não possui conteúdo para visualização.</p>
            <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
              <p><strong>Debug Info:</strong></p>
              <p>Pack ID: {pack.id}</p>
              <p>packContent: {JSON.stringify(pack.packContent)}</p>
              <p>Se você vê este pack no R2 mas não aqui, o problema é que o campo packContent não está populado no Firestore.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackContentViewer;
