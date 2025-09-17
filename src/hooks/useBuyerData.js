import { useState, useEffect, useCallback } from 'react';
import { enrichOrdersWithBuyerData, enrichOrderWithBuyerData } from '../utils/buyerDataUtils';

/**
 * Hook para gerenciar dados dos compradores em orders
 * @param {Array} orders - Array de orders
 * @param {boolean} autoEnrich - Se deve enriquecer automaticamente
 * @returns {Object} { enrichedOrders, loading, error, refreshBuyerData }
 */
export const useBuyerData = (orders = [], autoEnrich = true) => {
  const [enrichedOrders, setEnrichedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshBuyerData = useCallback(async () => {
    if (!orders || orders.length === 0) {
      setEnrichedOrders([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const enriched = await enrichOrdersWithBuyerData(orders);
      setEnrichedOrders(enriched);
    } catch (err) {
      console.error('Error enriching orders with buyer data:', err);
      setError(err);
      setEnrichedOrders(orders); // Fallback to original orders
    } finally {
      setLoading(false);
    }
  }, [orders]);

  useEffect(() => {
    if (autoEnrich) {
      refreshBuyerData();
    }
  }, [autoEnrich, refreshBuyerData]);

  return {
    enrichedOrders,
    loading,
    error,
    refreshBuyerData
  };
};

/**
 * Hook para enriquecer um único order com dados do comprador
 * @param {Object} order - Order object
 * @param {boolean} autoEnrich - Se deve enriquecer automaticamente
 * @returns {Object} { enrichedOrder, loading, error, refreshBuyerData }
 */
export const useBuyerDataForOrder = (order, autoEnrich = true) => {
  const [enrichedOrder, setEnrichedOrder] = useState(order);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshBuyerData = useCallback(async () => {
    if (!order) {
      setEnrichedOrder(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const enriched = await enrichOrderWithBuyerData(order);
      setEnrichedOrder(enriched);
    } catch (err) {
      console.error('Error enriching order with buyer data:', err);
      setError(err);
      setEnrichedOrder(order); // Fallback to original order
    } finally {
      setLoading(false);
    }
  }, [order]);

  useEffect(() => {
    if (autoEnrich) {
      refreshBuyerData();
    }
  }, [autoEnrich, refreshBuyerData]);

  return {
    enrichedOrder,
    loading,
    error,
    refreshBuyerData
  };
};
