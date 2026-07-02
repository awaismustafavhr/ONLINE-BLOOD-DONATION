import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  FaPlus, 
  FaSearch, 
  FaFilter, 
  FaEye, 
  FaEdit, 
  FaTrash, 
  FaMapMarkerAlt, 
  FaClock, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaTimes, 
  FaHeart,
  FaHandHoldingHeart,
  FaUser,
  FaPhone,
  FaHospital,
  FaCalendarAlt,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUserCheck,
  FaThumbsUp,
  FaThumbsDown
} from 'react-icons/fa';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { bloodRequestAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const BloodRequestsPage = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState('');
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [respondError, setRespondError] = useState('');
  const [showResponsesModal, setShowResponsesModal] = useState(false);

  // Fetch blood requests
  const { data: requestsData, isLoading: requestsLoading, error: requestsError, refetch: refetchRequests } = useQuery(
    ['blood-requests', { 
      searchTerm, 
      statusFilter, 
      urgencyFilter, 
      bloodTypeFilter, 
      sortBy, 
      sortOrder, 
      page: currentPage 
    }],
    async () => {
      console.log('Fetching blood requests with params:', {
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        urgency: urgencyFilter !== 'all' ? urgencyFilter : undefined,
        bloodType: bloodTypeFilter !== 'all' ? bloodTypeFilter : undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 10
      });
      
      const response = await bloodRequestAPI.getBloodRequests({
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        urgency: urgencyFilter !== 'all' ? urgencyFilter : undefined,
        bloodType: bloodTypeFilter !== 'all' ? bloodTypeFilter : undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 10
      });
      
      console.log('Raw API response:', response);
      console.log('Response data:', response?.data);
      
      return response.data; // Return the unwrapped data
    },
    {
      enabled: hasRole(['donor', 'recipient', 'medical_admin', 'system_admin']),
      refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
      onError: (error) => {
        console.error('Blood requests query error:', error);
        console.error('Error response:', error?.response);
      }
    }
  );

  // Create request mutation
  const [createError, setCreateError] = useState('');
  const createRequestMutation = useMutation(
    (requestData) => bloodRequestAPI.createBloodRequest(requestData),
    {
      onSuccess: (response) => {
        console.log('Blood request created successfully:', response);
        console.log('Created request data:', response?.data?.request);
        
        // Reset form by closing modal
        setCreateError('');
        setShowCreateModal(false);
        
        // Invalidate all blood request queries to force refetch
        queryClient.invalidateQueries({ 
          queryKey: ['blood-requests'],
          exact: false 
        });
        
        // Also refetch immediately
        setTimeout(() => {
          refetchRequests();
        }, 500);
      },
      onError: (error) => {
        console.error('Blood request creation error:', error);
        console.error('Error response:', error?.response?.data);
        console.error('Error status:', error?.response?.status);
        
        const status = error?.response?.status;
        const apiMsg = error?.response?.data?.message;
        const apiErrors = error?.response?.data?.errors;
        
        let errorMessage = 'Failed to create blood request.';
        
        if (apiMsg) {
          errorMessage = apiMsg;
        } else if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
          errorMessage = apiErrors.map(err => err.msg || err.message).join(', ');
        } else if (error?.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
        
        if (status === 403) {
          errorMessage = 'You are not authorized to create blood requests.';
        } else if (status === 400) {
          errorMessage = apiMsg || 'Validation failed. Please check all fields.';
        }
        
        if (!error.response) {
          errorMessage = 'Network error: Could not connect to server. Please check if the backend server is running.';
        }
        
        setCreateError(errorMessage);
      }
    }
  );

  // Update request mutation
  const updateRequestMutation = useMutation(
    ({ requestId, requestData }) => bloodRequestAPI.updateBloodRequest(requestId, requestData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('blood-requests');
        setShowRequestModal(false);
        setShowStatusUpdateModal(false);
        setSelectedRequest(null);
        setStatusUpdateError('');
      },
      onError: (error) => {
        console.error('Update request error:', error);
        const apiMsg = error?.response?.data?.message;
        setStatusUpdateError(apiMsg || 'Failed to update request status');
      }
    }
  );
  
  // Status update mutation (for medical admin)
  const updateStatusMutation = useMutation(
    ({ requestId, status }) => bloodRequestAPI.updateBloodRequest(requestId, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('blood-requests');
        setShowStatusUpdateModal(false);
        setSelectedRequest(null);
        setStatusUpdateError('');
      },
      onError: (error) => {
        console.error('Status update error:', error);
        const apiMsg = error?.response?.data?.message;
        setStatusUpdateError(apiMsg || 'Failed to update request status');
      }
    }
  );

  // Delete request mutation
  const deleteRequestMutation = useMutation(
    (requestId) => bloodRequestAPI.cancelBloodRequest(requestId, {}),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('blood-requests');
        setShowDeleteModal(false);
        setSelectedRequest(null);
      },
    }
  );

  // Respond to request mutation (for donors)
  const respondToRequestMutation = useMutation(
    ({ requestId, response, notes }) => bloodRequestAPI.respondToBloodRequest(requestId, { response, notes }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('blood-requests');
        setShowRespondModal(false);
        setSelectedRequest(null);
        setRespondError('');
      },
      onError: (error) => {
        console.error('Respond to request error:', error);
        const apiMsg = error?.response?.data?.message;
        setRespondError(apiMsg || 'Failed to respond to request');
      }
    }
  );

  // Extract requests data - handle both response formats
  // Backend returns: { success: true, data: { requests: [...], pagination: {...} } }
  // Axios unwraps to: response.data = { success: true, data: { requests: [...], pagination: {...} } }
  // React Query unwraps axios response.data automatically
  const requests = requestsData?.data?.requests || requestsData?.requests || [];
  const pagination = requestsData?.data?.pagination || requestsData?.pagination || {};
  
  // Debug logging
  console.log('=== BLOOD REQUESTS QUERY DEBUG ===');
  console.log('Full requestsData:', requestsData);
  console.log('requestsData.data:', requestsData?.data);
  console.log('requestsData.data?.requests:', requestsData?.data?.requests);
  console.log('Extracted requests:', requests);
  console.log('Requests count:', requests.length);
  console.log('Pagination:', pagination);
  console.log('Is loading:', requestsLoading);
  console.log('Query enabled:', hasRole(['recipient', 'medical_admin', 'system_admin']));
  console.log('===================================');

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'matched':
        return 'bg-blue-100 text-blue-800';
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get urgency color
  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get blood type color
  const getBloodTypeColor = (bloodType) => {
    const colors = {
      'A+': 'bg-red-100 text-red-800',
      'A-': 'bg-red-200 text-red-900',
      'B+': 'bg-blue-100 text-blue-800',
      'B-': 'bg-blue-200 text-blue-900',
      'AB+': 'bg-purple-100 text-purple-800',
      'AB-': 'bg-purple-200 text-purple-900',
      'O+': 'bg-green-100 text-green-800',
      'O-': 'bg-green-200 text-green-900'
    };
    return colors[bloodType] || 'bg-gray-100 text-gray-800';
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return FaSort;
    return sortOrder === 'asc' ? FaSortUp : FaSortDown;
  };

  // Check if user is medical admin
  const isMedicalAdmin = user?.role === 'medical_admin' || user?.role === 'system_admin';

  // Handle view request
  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  // Handle create request
  const handleCreateRequest = (requestData) => {
    createRequestMutation.mutate(requestData);
  };

  // Handle update request
  const handleUpdateRequest = (request) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
    // For now, recipients can only view, not edit via modal
    // Edit functionality can be added later if needed
  };

  // Handle update status (for medical admin)
  const handleUpdateStatus = (request) => {
    setSelectedRequest(request);
    setShowStatusUpdateModal(true);
    setStatusUpdateError('');
  };

  // Handle status update confirmation
  const handleStatusUpdateConfirm = (newStatus) => {
    updateStatusMutation.mutate({
      requestId: selectedRequest._id,
      status: newStatus
    });
  };

  // Handle delete request
  const handleDeleteRequest = (request) => {
    setSelectedRequest(request);
    setShowDeleteModal(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    deleteRequestMutation.mutate(selectedRequest._id);
  };

  // Handle respond to request (for donors)
  const handleRespondToRequest = (request) => {
    setSelectedRequest(request);
    setShowRespondModal(true);
    setRespondError('');
  };

  // Handle respond confirmation
  const handleRespondConfirm = (response, notes) => {
    respondToRequestMutation.mutate({
      requestId: selectedRequest._id,
      response,
      notes
    });
  };
  
  // Check if user is donor
  const isDonor = user?.role === 'donor';

  // Handle view responses (for medical admin)
  const handleViewResponses = (request) => {
    setSelectedRequest(request);
    setShowResponsesModal(true);
  };

  if (requestsLoading) {
    return <LoadingSpinner fullScreen text="Loading blood requests..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Blood Requests</h1>
          <p className="text-neutral-600 mt-1">
            Manage blood requests and find donors
          </p>
        </div>
        
        {hasRole(['recipient']) && (
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <FaPlus />
              <span>New Request</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Search
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Urgency
            </label>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              <option value="all">All Urgency</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Blood Type
            </label>
            <select
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              <option value="all">All Blood Types</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Sort By
            </label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="urgency-desc">Most Urgent</option>
              <option value="urgency-asc">Least Urgent</option>
              <option value="bloodType-asc">Blood Type A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Request Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Blood Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Urgency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Hospital
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {requests.map((request) => (
                <motion.tr
                  key={request._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-neutral-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          <FaHandHoldingHeart className="h-5 w-5 text-red-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-neutral-900">
                          {request.patientName || 'Unknown Patient'}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {request.requesterId?.firstName && request.requesterId?.lastName 
                            ? `${request.requesterId.firstName} ${request.requesterId.lastName}`
                            : request.requesterName || 'Unknown Requester'}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {request.requesterId?.email || request.requesterEmail || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getBloodTypeColor(request.bloodType)}>
                      {request.bloodType}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getUrgencyColor(request.urgency)}>
                      {request.urgency}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    <div className="flex items-center">
                      <FaHospital className="h-4 w-4 mr-1 text-neutral-400" />
                      {request.hospitalName || 'No hospital'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    <div className="flex items-center">
                      <FaCalendarAlt className="h-4 w-4 mr-1" />
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewRequest(request)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="View Request"
                      >
                        <FaEye />
                      </button>
                      {isDonor && ['confirmed', 'matched', 'fulfilled'].includes(request.status) && (
                        <button
                          onClick={() => handleRespondToRequest(request)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Respond to Request"
                        >
                          <FaHandHoldingHeart />
                        </button>
                      )}
                      {isMedicalAdmin && (
                        <>
                          {request.matchedDonors && request.matchedDonors.length > 0 && (
                            <button
                              onClick={() => handleViewResponses(request)}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title="View Responses"
                            >
                              <FaUserCheck />
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(request)}
                            className="text-purple-600 hover:text-purple-900 p-1"
                            title="Update Status"
                          >
                            <FaCheckCircle />
                          </button>
                        </>
                      )}
                      {hasRole(['recipient']) && (
                        (request.requesterId?._id?.toString() === user?._id?.toString() || 
                         request.requesterId?.toString() === user?._id?.toString()) && (
                          <>
                            <button
                              onClick={() => handleUpdateRequest(request)}
                              className="text-green-600 hover:text-green-900 p-1"
                              title="Edit Request"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(request)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete Request"
                            >
                              <FaTrash />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-neutral-200">
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* View Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Blood Request Details"
        size="xl"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Patient Information Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Patient Name</label>
                  <p className="text-neutral-900">{selectedRequest.patientName || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Patient Age</label>
                  <p className="text-neutral-900">{selectedRequest.patientAge || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Patient Gender</label>
                  <p className="text-neutral-900 capitalize">{selectedRequest.patientGender || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Patient Blood Type</label>
                  <Badge className={getBloodTypeColor(selectedRequest.patientBloodType)}>
                    {selectedRequest.patientBloodType || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Requester Information Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Requester Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Requester Name</label>
                  <p className="text-neutral-900">
                    {selectedRequest.requesterId?.firstName && selectedRequest.requesterId?.lastName
                      ? `${selectedRequest.requesterId.firstName} ${selectedRequest.requesterId.lastName}`
                      : selectedRequest.requesterName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Requester Email</label>
                  <p className="text-neutral-900">{selectedRequest.requesterId?.email || selectedRequest.requesterEmail || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Requester Phone</label>
                  <p className="text-neutral-900">{selectedRequest.requesterId?.phone || selectedRequest.requesterPhone || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Hospital Information Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Hospital Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Hospital Name</label>
                  <p className="text-neutral-900">{selectedRequest.hospitalName || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Hospital Address</label>
                  <p className="text-neutral-900">{selectedRequest.hospitalAddress || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Hospital Phone</label>
                  <p className="text-neutral-900">{selectedRequest.hospitalPhone || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Doctor Name</label>
                  <p className="text-neutral-900">{selectedRequest.doctorName || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Doctor Phone</label>
                  <p className="text-neutral-900">{selectedRequest.doctorPhone || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Blood Request Details Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Blood Request Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Blood Type Needed</label>
                  <Badge className={getBloodTypeColor(selectedRequest.bloodType)}>
                    {selectedRequest.bloodType || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Blood Units</label>
                  <p className="text-neutral-900">{selectedRequest.bloodUnits || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Blood Group</label>
                  <p className="text-neutral-900 capitalize">{selectedRequest.bloodGroup?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Urgency</label>
                  <Badge className={getUrgencyColor(selectedRequest.urgency)}>
                    {selectedRequest.urgency || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Medical Reason</label>
                  <p className="text-neutral-900 capitalize">{selectedRequest.medicalReason || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Required By</label>
                  <p className="text-neutral-900">
                    {selectedRequest.requiredBy 
                      ? new Date(selectedRequest.requiredBy).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                {selectedRequest.medicalReasonDescription && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Medical Reason Description</label>
                    <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                      {selectedRequest.medicalReasonDescription}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Location Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
                  <p className="text-neutral-900">{selectedRequest.city || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
                  <p className="text-neutral-900">{selectedRequest.state || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Status and Dates Section */}
            <div className="border-b border-neutral-200 pb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Status & Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <Badge className={getStatusColor(selectedRequest.status)}>
                    {selectedRequest.status || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Created Date</label>
                  <p className="text-neutral-900">
                    {selectedRequest.createdAt 
                      ? new Date(selectedRequest.createdAt).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                {selectedRequest.requiredBy && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Required By</label>
                    <p className="text-neutral-900">
                      {new Date(selectedRequest.requiredBy).toLocaleString()}
                    </p>
                  </div>
                )}
                {selectedRequest.completedAt && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Completed Date</label>
                    <p className="text-neutral-900">
                      {new Date(selectedRequest.completedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Notes */}
            {selectedRequest.additionalNotes && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Additional Notes</label>
                <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                  {selectedRequest.additionalNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Request Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Blood Request"
        size="lg"
      >
        {createError && (
          <div className="mb-4 px-4 py-3 rounded bg-red-50 text-red-800 border border-red-200">
            {createError}
          </div>
        )}
        <CreateRequestForm
          onSubmit={handleCreateRequest}
          onCancel={() => {
            setShowCreateModal(false);
            setCreateError('');
          }}
          isLoading={createRequestMutation.isLoading}
        />
      </Modal>

      {/* View Responses Modal (for medical admin) */}
      {isMedicalAdmin && (
        <Modal
          isOpen={showResponsesModal}
          onClose={() => {
            setShowResponsesModal(false);
            setSelectedRequest(null);
          }}
          title="Donor Responses"
          size="lg"
        >
          {selectedRequest && (
            <ViewResponsesForm
              request={selectedRequest}
              onUpdateStatus={() => {
                setShowResponsesModal(false);
                handleUpdateStatus(selectedRequest);
              }}
              onClose={() => {
                setShowResponsesModal(false);
                setSelectedRequest(null);
              }}
            />
          )}
        </Modal>
      )}

      {/* Status Update Modal (for medical admin) */}
      {isMedicalAdmin && (
        <Modal
          isOpen={showStatusUpdateModal}
          onClose={() => {
            setShowStatusUpdateModal(false);
            setStatusUpdateError('');
            setSelectedRequest(null);
          }}
          title="Update Request Status"
          size="md"
        >
          {selectedRequest && (
            <StatusUpdateForm
              currentStatus={selectedRequest.status}
              onUpdate={handleStatusUpdateConfirm}
              onCancel={() => {
                setShowStatusUpdateModal(false);
                setStatusUpdateError('');
                setSelectedRequest(null);
              }}
              isLoading={updateStatusMutation.isLoading}
              error={statusUpdateError}
            />
          )}
        </Modal>
      )}

      {/* Respond to Request Modal (for donors) */}
      {isDonor && (
        <Modal
          isOpen={showRespondModal}
          onClose={() => {
            setShowRespondModal(false);
            setRespondError('');
            setSelectedRequest(null);
          }}
          title="Respond to Blood Request"
          size="md"
        >
          {selectedRequest && (
            <RespondToRequestForm
              request={selectedRequest}
              onRespond={handleRespondConfirm}
              onCancel={() => {
                setShowRespondModal(false);
                setRespondError('');
                setSelectedRequest(null);
              }}
              isLoading={respondToRequestMutation.isLoading}
              error={respondError}
            />
          )}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Blood Request"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            Are you sure you want to delete this blood request? This action cannot be undone.
          </p>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={deleteRequestMutation.isLoading}
            >
              Delete Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Create Request Form Component
const CreateRequestForm = ({ onSubmit, onCancel, isLoading }) => {
  const { user } = useAuth();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    // Patient Information
    patientName: '',
    patientAge: '',
    patientGender: 'male',
    patientBloodType: '',
    // Hospital Information
    hospitalName: '',
    hospitalAddress: '',
    hospitalPhone: '',
    doctorName: '',
    doctorPhone: '',
    // Blood Request Details
    medicalReason: 'other',
    medicalReasonDescription: '',
    bloodType: '',
    bloodUnits: 1,
    bloodGroup: 'whole_blood',
    urgency: 'medium',
    requiredBy: tomorrow,
    // Location
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    latitude: user?.address?.latitude || 0,
    longitude: user?.address?.longitude || 0,
    // Additional
    additionalNotes: ''
  });

  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear form error when user starts typing
    if (formError) setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(''); // Clear previous errors
    
    // Client-side validation
    if (!formData.patientName || formData.patientName.trim().length < 2) {
      setFormError('Patient name must be at least 2 characters.');
      return;
    }
    
    if (!formData.patientAge || parseInt(formData.patientAge) < 0 || parseInt(formData.patientAge) > 120) {
      setFormError('Valid patient age is required (0-120).');
      return;
    }
    
    if (!formData.patientBloodType) {
      setFormError('Patient blood type is required.');
      return;
    }
    
    if (!formData.hospitalName || formData.hospitalName.trim().length < 2) {
      setFormError('Hospital name must be at least 2 characters.');
      return;
    }
    
    if (!formData.hospitalAddress || formData.hospitalAddress.trim().length < 5) {
      setFormError('Hospital address must be at least 5 characters.');
      return;
    }
    
    if (!formData.hospitalPhone || formData.hospitalPhone.trim().length < 10) {
      setFormError('Valid hospital phone number is required.');
      return;
    }
    
    if (!formData.doctorName || formData.doctorName.trim().length < 2) {
      setFormError('Doctor name must be at least 2 characters.');
      return;
    }
    
    if (!formData.doctorPhone || formData.doctorPhone.trim().length < 10) {
      setFormError('Valid doctor phone number is required.');
      return;
    }
    
    if (!formData.bloodType) {
      setFormError('Blood type is required.');
      return;
    }
    
    if (!formData.requiredBy) {
      setFormError('Required by date is required.');
      return;
    }
    
    // Validate date is in the future
    const requiredByDate = new Date(formData.requiredBy);
    if (requiredByDate <= new Date()) {
      setFormError('Required by date must be in the future.');
      return;
    }
    
    if (!formData.city || formData.city.trim().length < 2) {
      setFormError('City is required.');
      return;
    }
    
    if (!formData.state || formData.state.trim().length < 2) {
      setFormError('State is required.');
      return;
    }
    
    // Ensure requiredBy is in ISO8601 format
    const isoDate = requiredByDate.toISOString();
    
    onSubmit({
      ...formData,
      patientAge: parseInt(formData.patientAge),
      bloodUnits: parseInt(formData.bloodUnits),
      latitude: parseFloat(formData.latitude) || 0,
      longitude: parseFloat(formData.longitude) || 0,
      requiredBy: isoDate,
      isEmergency: formData.urgency === 'critical'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="px-4 py-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
          {formError}
        </div>
      )}

      {/* Patient Information Section */}
      <div className="border-b border-neutral-200 pb-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Patient Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Enter patient name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="patientAge"
              value={formData.patientAge}
              onChange={handleChange}
              min="0"
              max="120"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Age"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient Gender <span className="text-red-500">*</span>
            </label>
            <select
              name="patientGender"
              value={formData.patientGender}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient Blood Type <span className="text-red-500">*</span>
            </label>
            <select
              name="patientBloodType"
              value={formData.patientBloodType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="">Select Blood Type</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Hospital Information Section */}
      <div className="border-b border-neutral-200 pb-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Hospital Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Hospital Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="hospitalName"
              value={formData.hospitalName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Enter hospital name"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Hospital Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="hospitalAddress"
              value={formData.hospitalAddress}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Enter full hospital address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Hospital Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="hospitalPhone"
              value={formData.hospitalPhone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Hospital phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Doctor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="doctorName"
              value={formData.doctorName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Doctor name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Doctor Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="doctorPhone"
              value={formData.doctorPhone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="Doctor phone number"
            />
          </div>
        </div>
      </div>

      {/* Blood Request Details Section */}
      <div className="border-b border-neutral-200 pb-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Blood Request Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Medical Reason <span className="text-red-500">*</span>
            </label>
            <select
              name="medicalReason"
              value={formData.medicalReason}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="surgery">Surgery</option>
              <option value="accident">Accident</option>
              <option value="disease">Disease</option>
              <option value="childbirth">Childbirth</option>
              <option value="cancer">Cancer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Blood Type Needed <span className="text-red-500">*</span>
            </label>
            <select
              name="bloodType"
              value={formData.bloodType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="">Select Blood Type</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Blood Units <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="bloodUnits"
              value={formData.bloodUnits}
              onChange={handleChange}
              min="1"
              max="10"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Blood Group <span className="text-red-500">*</span>
            </label>
            <select
              name="bloodGroup"
              value={formData.bloodGroup}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="whole_blood">Whole Blood</option>
              <option value="red_cells">Red Cells</option>
              <option value="platelets">Platelets</option>
              <option value="plasma">Plasma</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Urgency <span className="text-red-500">*</span>
            </label>
            <select
              name="urgency"
              value={formData.urgency}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Required By <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="requiredBy"
              value={formData.requiredBy}
              onChange={handleChange}
              min={tomorrow}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
            />
          </div>
          {formData.medicalReason === 'other' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Medical Reason Description
              </label>
              <textarea
                name="medicalReasonDescription"
                value={formData.medicalReasonDescription}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                placeholder="Please describe the medical reason..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Location Section */}
      <div className="border-b border-neutral-200 pb-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Location</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="City"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              State <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              required
              placeholder="State"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          placeholder="Any additional information about the request..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
        >
          Create Request
        </Button>
      </div>
    </form>
  );
};

// Status Update Form Component (for medical admin)
const StatusUpdateForm = ({ currentStatus, onUpdate, onCancel, isLoading, error }) => {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedStatus !== currentStatus) {
      onUpdate(selectedStatus);
    } else {
      onCancel();
    }
  };

  // Get available statuses based on current status
  const getAvailableStatuses = () => {
    const allStatuses = ['pending', 'matched', 'confirmed', 'fulfilled', 'completed', 'cancelled'];
    
    // Can't change from completed or cancelled
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return [currentStatus];
    }
    
    // Can change to any status except completed/cancelled (those have separate routes)
    return allStatuses.filter(s => s !== 'completed' && s !== 'cancelled');
  };

  const availableStatuses = getAvailableStatuses();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Current Status
        </label>
        <div className="px-3 py-2 bg-neutral-100 rounded-lg">
          <span className="text-neutral-900 capitalize">{currentStatus}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          New Status <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          required
        >
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Note: Status changes from "completed" or "cancelled" are not allowed. Use separate actions for those.
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={selectedStatus === currentStatus}
        >
          Update Status
        </Button>
      </div>
    </form>
  );
};

// Respond to Request Form Component (for donors)
const RespondToRequestForm = ({ request, onRespond, onCancel, isLoading, error }) => {
  const [response, setResponse] = useState('accept');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRespond(response, notes);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-neutral-50 p-4 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Patient:</span>
          <span className="text-sm text-neutral-900">{request.patientName || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Blood Type:</span>
          <span className="text-sm text-neutral-900">{request.bloodType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Hospital:</span>
          <span className="text-sm text-neutral-900">{request.hospitalName || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Urgency:</span>
          <span className={`text-sm px-2 py-1 rounded ${
            request.urgency === 'critical' ? 'bg-red-100 text-red-800' :
            request.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
            request.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {request.urgency}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Required By:</span>
          <span className="text-sm text-neutral-900">
            {request.requiredBy ? new Date(request.requiredBy).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Your Response <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3 p-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-50">
            <input
              type="radio"
              name="response"
              value="accept"
              checked={response === 'accept'}
              onChange={(e) => setResponse(e.target.value)}
              className="text-blood-500 focus:ring-blood-500"
            />
            <div className="flex items-center space-x-2">
              <FaThumbsUp className="text-green-600" />
              <span className="text-neutral-900">Accept - I can help with this request</span>
            </div>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-50">
            <input
              type="radio"
              name="response"
              value="decline"
              checked={response === 'decline'}
              onChange={(e) => setResponse(e.target.value)}
              className="text-blood-500 focus:ring-blood-500"
            />
            <div className="flex items-center space-x-2">
              <FaThumbsDown className="text-red-600" />
              <span className="text-neutral-900">Decline - I cannot help at this time</span>
            </div>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          placeholder="Add any additional information or comments..."
          maxLength={500}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {notes.length}/500 characters
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
        >
          {response === 'accept' ? 'Accept Request' : 'Decline Request'}
        </Button>
      </div>
    </form>
  );
};

// View Responses Form Component (for medical admin)
const ViewResponsesForm = ({ request, onUpdateStatus, onClose }) => {
  const responses = request.matchedDonors || [];
  const acceptedResponses = responses.filter(r => r.status === 'accepted');
  const declinedResponses = responses.filter(r => r.status === 'declined');
  const pendingResponses = responses.filter(r => r.status === 'pending');

  const getStatusBadge = (status) => {
    const colors = {
      'accepted': 'bg-green-100 text-green-800',
      'declined': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Request Summary */}
      <div className="bg-neutral-50 p-4 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Request ID:</span>
          <span className="text-sm text-neutral-900 font-mono">{request._id?.slice(-8) || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Patient:</span>
          <span className="text-sm text-neutral-900">{request.patientName || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Blood Type:</span>
          <span className="text-sm text-neutral-900">{request.bloodType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Status:</span>
          <span className={`text-sm px-2 py-1 rounded ${getStatusBadge(request.status)}`}>
            {request.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Total Responses:</span>
          <span className="text-sm text-neutral-900 font-semibold">{responses.length}</span>
        </div>
      </div>

      {/* Response Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{acceptedResponses.length}</div>
          <div className="text-sm text-green-700">Accepted</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{declinedResponses.length}</div>
          <div className="text-sm text-red-700">Declined</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">{pendingResponses.length}</div>
          <div className="text-sm text-yellow-700">Pending</div>
        </div>
      </div>

      {/* Responses List */}
      {responses.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <FaUserCheck className="mx-auto text-4xl mb-2 text-neutral-300" />
          <p>No donor responses yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">All Responses ({responses.length})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {responses.map((response, index) => (
              <div key={index} className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-neutral-900">
                        {response.donorId?.firstName && response.donorId?.lastName
                          ? `${response.donorId.firstName} ${response.donorId.lastName}`
                          : response.donorName || 'Unknown Donor'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(response.status)}`}>
                        {response.status}
                      </span>
                    </div>
                    <div className="text-sm text-neutral-600 space-y-1">
                      {(response.donorId?.phone || response.donorPhone) && (
                        <div className="flex items-center space-x-1">
                          <FaPhone className="text-xs" />
                          <span>{response.donorId?.phone || response.donorPhone}</span>
                        </div>
                      )}
                      {response.donorId?.bloodType && (
                        <div className="flex items-center space-x-1">
                          <FaHeart className="text-xs" />
                          <span>Blood Type: {response.donorId.bloodType}</span>
                        </div>
                      )}
                      {response.matchedAt && (
                        <div className="flex items-center space-x-1">
                          <FaCalendarAlt className="text-xs" />
                          <span>Responded: {new Date(response.matchedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {response.notes && (
                  <div className="mt-2 pt-2 border-t border-neutral-200">
                    <p className="text-sm text-neutral-700">
                      <span className="font-medium">Notes:</span> {response.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Close
        </Button>
        {acceptedResponses.length > 0 && (
          <Button
            type="button"
            onClick={onUpdateStatus}
          >
            Update Status
          </Button>
        )}
      </div>
    </div>
  );
};

export default BloodRequestsPage;