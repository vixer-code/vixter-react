import React from 'react';
import './DeleteConfirmationModal.css';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, postContent }) => {
  if (!isOpen) return null;

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-header">
          <i className="fa-solid fa-exclamation-triangle"></i>
          <h3>Confirmar Exclusão</h3>
        </div>
        
        <div className="delete-modal-body">
          <p>Tem certeza que deseja excluir esta publicação?</p>
          {postContent && (
            <div className="post-preview">
              <p className="post-preview-label">Conteúdo da publicação:</p>
              <div className="post-preview-content">
                {postContent.length > 100 
                  ? `${postContent.substring(0, 100)}...` 
                  : postContent
                }
              </div>
            </div>
          )}
          <p className="warning-text">
            <i className="fa-solid fa-info-circle"></i>
            Esta ação não pode ser desfeita.
          </p>
        </div>
        
        <div className="delete-modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-delete" onClick={onConfirm}>
            <i className="fa-solid fa-trash"></i>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
