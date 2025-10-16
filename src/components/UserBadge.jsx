import React from 'react';
import './UserBadge.css';

const UserBadge = ({ user, className = '' }) => {
  // Check if user is admin
  const isAdmin = user?.admin === true;

  if (!isAdmin) {
    return null; // Don't render anything if user doesn't have admin badge
  }

  return (
    <div className={`user-badge admin-badge ${className}`}>
      <img 
        src="/images/admin.png" 
        alt="Administrador" 
        className="badge-icon"
        title="Administrador"
      />
    </div>
  );
};

export default UserBadge;
