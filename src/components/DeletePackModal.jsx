import React from 'react';
import './DeleteConfirmationModal.css';

const DeletePackModal = ({ isOpen, onClose, onConfirm, packTitle, progress = 0, status = '' }) => {
  if (!isOpen) return null;

  const isDeleting = progress > 0 && progress < 100;

  return (
    <div className="delete-modal-overlay" onClick={!isDeleting ? onClose : undefined}>
      <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-header">
          <i className="fa-solid fa-exclamation-triangle"></i>
          <h3>{isDeleting ? 'Excluindo Pack' : 'Confirmar Exclusão do pack'}</h3>
        </div>
        
        <div className="delete-modal-body">
          {!isDeleting ? (
            <>
              <p>Tem certeza que deseja excluir este pack?</p>
              {packTitle && (
                <div className="post-preview">
                  <p className="post-preview-label">Nome do pack:</p>
                  <div className="post-preview-content">
                    {packTitle}
                  </div>
                </div>
              )}
              <p className="warning-text">
                <i className="fa-solid fa-info-circle"></i>
                Esta ação não pode ser desfeita.
              </p>
            </>
          ) : (
            <div className="delete-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-status">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>{status}</span>
              </div>
              <div className="progress-percentage">
                {progress}%
              </div>
            </div>
          )}
        </div>
        
        {!isDeleting && (
          <div className="delete-modal-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-delete" onClick={onConfirm}>
              <i className="fa-solid fa-trash"></i>
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeletePackModal;
