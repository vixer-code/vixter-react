import React from 'react';
import './DeleteConfirmationModal.css';

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  itemType = 'item', // 'post', 'pack', 'service'
  itemData = null 
}) => {
  if (!isOpen) return null;

  const renderItemInfo = () => {
    if (!itemData) return null;

    switch (itemType) {
      case 'pack':
        return (
          <div className="item-info">
            <h4 className="item-name">{itemData.title || 'Pack sem título'}</h4>
            <div className="item-price">
              {itemData.price ? (
                <>
                  <span className="price-amount">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(itemData.price)}
                  </span>
                  {itemData.discount > 0 && (
                    <span className="price-discount">
                      (Desconto: {itemData.discount}%)
                    </span>
                  )}
                </>
              ) : (
                <span className="price-free">Gratuito</span>
              )}
            </div>
            {itemData.description && (
              <p className="item-description">
                {itemData.description.length > 100 
                  ? `${itemData.description.substring(0, 100)}...` 
                  : itemData.description
                }
              </p>
            )}
          </div>
        );

      case 'service':
        return (
          <div className="item-info">
            <h4 className="item-name">{itemData.title || 'Serviço sem título'}</h4>
            <div className="item-price">
              {itemData.price ? (
                <span className="price-amount">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(itemData.price)}
                </span>
              ) : (
                <span className="price-free">Gratuito</span>
              )}
            </div>
            {itemData.description && (
              <p className="item-description">
                {itemData.description.length > 100 
                  ? `${itemData.description.substring(0, 100)}...` 
                  : itemData.description
                }
              </p>
            )}
          </div>
        );

      case 'post':
      default:
        return (
          <div className="item-info">
            <h4 className="item-name">Publicação</h4>
            {itemData.content && (
              <p className="item-description">
                {itemData.content.length > 100 
                  ? `${itemData.content.substring(0, 100)}...` 
                  : itemData.content
                }
              </p>
            )}
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (itemType) {
      case 'pack':
        return 'Excluir Pack';
      case 'service':
        return 'Excluir Serviço';
      case 'post':
      default:
        return 'Excluir Publicação';
    }
  };

  const getMessage = () => {
    switch (itemType) {
      case 'pack':
        return 'Tem certeza que deseja excluir este pack? Esta ação não pode ser desfeita.';
      case 'service':
        return 'Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.';
      case 'post':
      default:
        return 'Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.';
    }
  };

  return (
    <div className="delete-confirmation-overlay" onClick={onClose}>
      <div className="delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{getTitle()}</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="warning-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          
          <p className="confirmation-message">{getMessage()}</p>
          
          {renderItemInfo()}
        </div>
        
        <div className="modal-actions">
          <button className="btn btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-delete" onClick={onConfirm}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
