import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  FaPlus, 
  FaSearch, 
  FaEye, 
  FaCheckCircle, 
  FaHeart,
  FaUser,
  FaCalendarAlt,
  FaTint,
  FaUserMd
} from 'react-icons/fa';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { donationAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const DonationsPage = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  
  // Check if user is medically verified
  const isMedicallyVerified = user?.isMedicalVerified === true;
  
  // Debug: Log user and role check
  console.log('DonationsPage - User:', user);
  console.log('DonationsPage - User role:', user?.role);
  const roleCheck = hasRole(['donor', 'recipient', 'medical_admin', 'system_admin']);
  console.log('DonationsPage - hasRole check:', roleCheck);
  console.log('DonationsPage - User state user:', user);
  console.log('DonationsPage - User state user role:', user?.role);
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [respondDonation, setRespondDonation] = useState(null);
  const [respondError, setRespondError] = useState('');
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [responsesList, setResponsesList] = useState([]);
  const [donationStatus, setDonationStatus] = useState('scheduled');


  // Fetch donations
  const { data: donationsData, isLoading: donationsLoading, refetch: refetchDonations } = useQuery(
    ['donations', { 
      searchTerm, 
      statusFilter, 
      bloodTypeFilter, 
      dateFrom, 
      dateTo, 
      sortBy, 
      sortOrder, 
      page: currentPage 
    }],
    async () => {
      console.log('Fetching donations with params:', {
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        bloodType: bloodTypeFilter !== 'all' ? bloodTypeFilter : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 10
      });
      
      const response = await donationAPI.getDonations({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        bloodType: bloodTypeFilter !== 'all' ? bloodTypeFilter : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
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
      enabled: !!user && hasRole(['donor', 'recipient', 'medical_admin', 'system_admin']),
      refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
      onError: (error) => {
        console.error('Donations query error:', error);
        console.error('Error response:', error?.response);
      }
    }
  );

  // Schedule donation mutation (donor self-service)
  const [createError, setCreateError] = useState('');
  const createDonationMutation = useMutation(
    (donationData) => donationAPI.scheduleDonation(donationData),
    {
      onSuccess: (response) => {
        console.log('Donation created successfully:', response);
        console.log('Created donation data:', response?.data?.donation);
        
        // Reset form by closing modal
        setCreateError('');
        setShowCreateModal(false);
        
        // Invalidate all donation queries to force refetch
        queryClient.invalidateQueries({ 
          queryKey: ['donations'],
          exact: false 
        });
        
        // Also refetch immediately
        setTimeout(() => {
          refetchDonations();
        }, 500);
      },
      onError: (error) => {
        console.error('Donation creation error:', error);
        console.error('Error response:', error?.response?.data);
        console.error('Error status:', error?.response?.status);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        const status = error?.response?.status;
        const apiMsg = error?.response?.data?.message;
        const errorMsg = error?.response?.data?.error;
        const errors = error?.response?.data?.errors;
        const code = error?.response?.data?.code;
        const errorDetails = error?.response?.data?.errorDetails;
        
        // Build detailed error message
        let errorMessage = apiMsg || 'Failed to schedule donation.';
        
        // Add error details if available
        if (errorMsg) {
          errorMessage = errorMsg;
        }
        
        // Handle specific error codes
        if (code === 'MEDICAL_NOT_VERIFIED' || status === 403) {
          errorMessage = 'Medical verification is required to schedule donations. Please contact the medical administrator to verify your account.';
        } else if (code === 'MISSING_PHONE') {
          errorMessage = 'Your phone number is required. Please update your profile with a phone number before scheduling donations.';
        } else if (code === 'MISSING_BLOOD_TYPE') {
          errorMessage = 'Your blood type is required. Please update your profile with your blood type before scheduling donations.';
        } else if (code === 'DONATION_ELIGIBILITY_FAILED') {
          errorMessage = apiMsg || 'You may not be eligible to donate at this time. Please check your profile information.';
        } else if (errors) {
          // Handle array of errors or single error string
          if (Array.isArray(errors)) {
            const errorDetailsList = errors.map(e => {
              if (typeof e === 'string') return e;
              if (typeof e === 'object') return e.msg || e.message || JSON.stringify(e);
              return String(e);
            }).join(', ');
            errorMessage = errorMessage + (errorDetailsList ? ` ${errorDetailsList}` : '');
          } else if (typeof errors === 'string') {
            errorMessage = errors;
          }
        }
        
        // Add error details from development mode
        if (errorDetails && errorDetails.name) {
          errorMessage += ` (${errorDetails.name})`;
        }
        
        // If no specific error found, show generic message with status
        if (errorMessage === 'Failed to schedule donation.' && status) {
          errorMessage += ` (HTTP ${status})`;
        }
        
        // If network error, show connection issue
        if (!error.response) {
          errorMessage = 'Network error: Could not connect to server. Please check if the backend server is running.';
        }
        
        setCreateError(errorMessage);
      }
    }
  );

  // Recipient respond mutation
  const respondMutation = useMutation(
    ({ id, data }) => donationAPI.respondToDonation(id, data),
    {
      onSuccess: () => {
        setRespondError('');
        setShowRespondModal(false);
        setRespondDonation(null);
        queryClient.invalidateQueries({ queryKey: ['donations'], exact: false });
      },
      onError: (error) => {
        const msg = error?.response?.data?.message || 'Failed to submit response';
        setRespondError(msg);
      }
    }
  );

  // Admin set recipient review mutation
  const statusMutation = useMutation(
    ({ id, data }) => donationAPI.updateDonationStatus(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['donations'], exact: false });
        setShowResponsesModal(false);
      }
    }
  );

  // Admin/medical actions (not exposed to donors here) can be handled via dedicated pages

  // Extract donations data - handle both response formats
  // Backend returns: { success: true, data: { donations: [...], pagination: {...} } }
  // Axios unwraps to: response.data = { success: true, data: { donations: [...], pagination: {...} } }
  // React Query unwraps axios response.data automatically
  const donations = donationsData?.data?.donations || donationsData?.donations || [];
  const pagination = donationsData?.data?.pagination || donationsData?.pagination || {};
  
  // Debug logging - expanded to see full structure
  console.log('=== DONATIONS QUERY DEBUG ===');
  console.log('Full donationsData:', donationsData);
  console.log('donationsData.data:', donationsData?.data);
  console.log('donationsData.data?.donations:', donationsData?.data?.donations);
  console.log('Extracted donations:', donations);
  console.log('Donations count:', donations.length);
  console.log('Pagination:', pagination);
  console.log('Is loading:', donationsLoading);
  console.log('Query enabled:', hasRole(['donor', 'recipient', 'medical_admin', 'system_admin']));
  console.log('User role:', user?.role);
  console.log('User:', user);
  console.log('===========================');

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'tested':
        return 'bg-purple-100 text-purple-800';
      case 'stored':
        return 'bg-indigo-100 text-indigo-800';
      case 'distributed':
        return 'bg-emerald-100 text-emerald-800';
      case 'discarded':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
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

  // Handle view donation
  const handleViewDonation = (donation) => {
    setSelectedDonation(donation);
    setShowDonationModal(true);
  };

  // Handle create donation
  const handleCreateDonation = (donationData) => {
    // Prepare data for backend - ensure correct types
    const payload = {
      donationType: donationData.donationType,
      bloodUnits: parseInt(donationData.bloodUnits, 10), // Convert to integer
      scheduledDate: donationData.scheduledDate, // Should be ISO8601 format (YYYY-MM-DD)
      scheduledTime: donationData.scheduledTime,
      collectionSite: donationData.collectionSite.trim(),
      additionalNotes: donationData.additionalNotes || undefined
    };
    
    // Only include requestId if it's provided and not empty
    if (donationData.requestId && donationData.requestId.trim()) {
      payload.requestId = donationData.requestId.trim();
    }
    
    console.log('Sending donation payload:', payload);
    createDonationMutation.mutate(payload);
  };


  if (donationsLoading) {
    return <LoadingSpinner fullScreen text="Loading donations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Blood Donations</h1>
          <p className="text-neutral-600 mt-1">
            {hasRole(['recipient']) 
              ? 'View donations related to your blood requests'
              : 'Track and manage blood donations'}
          </p>
        </div>
        
        {hasRole(['donor', 'medical_admin']) && (
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            {hasRole(['donor']) && !isMedicallyVerified && (
              <div className="text-sm text-yellow-600 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                ⚠️ Medical verification required to schedule donations
              </div>
            )}
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center space-x-2"
              disabled={hasRole(['donor']) && !isMedicallyVerified}
              title={hasRole(['donor']) && !isMedicallyVerified ? 'Medical verification required' : ''}
            >
              <FaPlus />
              <span>Record Donation</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Search
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search donations..."
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
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="tested">Tested</option>
              <option value="stored">Stored</option>
              <option value="distributed">Distributed</option>
              <option value="discarded">Discarded</option>
              <option value="cancelled">Cancelled</option>
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
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            />
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
              <option value="bloodUnits-desc">Most Units</option>
              <option value="bloodUnits-asc">Least Units</option>
              <option value="status-asc">Status A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Donations Table */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Donor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Blood Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Scheduled Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actual Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {donations.length > 0 ? (
                donations.map((donation) => (
                  <motion.tr
                    key={donation._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-neutral-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            <FaUser className="h-5 w-5 text-red-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-neutral-900">
                            {donation.donorId?.firstName ? `${donation.donorId.firstName} ${donation.donorId.lastName}` : (donation.donorName || 'Unknown')}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {donation.donorId?.email || donation.donorEmail || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getBloodTypeColor(donation.donorBloodType)}>
                        {donation.donorBloodType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      <div className="flex items-center">
                        <FaTint className="h-4 w-4 mr-1 text-red-500" />
                        {(donation.bloodUnits || 0) * 450} ml
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusColor(donation.status)}>
                        {donation.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      <div className="flex items-center">
                        <FaCalendarAlt className="h-4 w-4 mr-1" />
                        {donation.scheduledDate ? new Date(donation.scheduledDate).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {donation.actualDate ? new Date(donation.actualDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDonation(donation)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View Donation"
                        >
                          <FaEye />
                        </button>
                        {hasRole(['recipient']) && (
                          (() => {
                            const alreadyResponded = Array.isArray(donation.recipientResponses) && donation.recipientResponses.some(r => r.recipientId === user?._id || r.recipientId?._id === user?._id);
                            return (
                              <button
                                onClick={() => { setRespondDonation(donation); setShowRespondModal(true); setRespondError(''); }}
                                className={`p-1 ${alreadyResponded ? 'text-neutral-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}
                                title={alreadyResponded ? 'You already responded' : 'Respond to Donation'}
                                disabled={alreadyResponded}
                              >
                                <FaCheckCircle />
                              </button>
                            );
                          })()
                        )}
                        {hasRole(['medical_admin', 'system_admin']) && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await donationAPI.getDonationResponses(donation._id);
                                setResponsesList(res?.data?.data?.responses || res?.data?.responses || []);
                                setSelectedDonation(donation);
                                setShowResponsesModal(true);
                              } catch (e) {
                                console.error('Failed to fetch responses', e);
                              }
                            }}
                            className="text-purple-600 hover:text-purple-800 p-1"
                            title="View Recipient Responses"
                          >
                            <FaUserMd />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <FaHeart className="text-4xl text-neutral-300 mb-4" />
                      <p className="text-neutral-600 text-lg font-medium mb-2">No donations found</p>
                      <p className="text-neutral-500 text-sm">
                        {hasRole(['donor']) 
                          ? 'You haven\'t scheduled any donations yet. Click "Record Donation" to schedule one.'
                          : 'No donations match your current filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
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

      {/* View Donation Modal */}
      <Modal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
        title="Donation Details"
        size="lg"
      >
        {selectedDonation && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Donor</label>
                <p className="text-neutral-900">{selectedDonation.donorId?.firstName ? `${selectedDonation.donorId.firstName} ${selectedDonation.donorId.lastName}` : (selectedDonation.donorName || 'Unknown')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Email</label>
                <p className="text-neutral-900">{selectedDonation.donorId?.email || selectedDonation.donorEmail || 'No email'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Blood Type</label>
                <Badge className={getBloodTypeColor(selectedDonation.donorBloodType)}>
                  {selectedDonation.donorBloodType}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Units</label>
                <p className="text-neutral-900">{(selectedDonation.bloodUnits || 0) * 450} ml</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Status</label>
                <Badge className={getStatusColor(selectedDonation.status)}>
                  {selectedDonation.status}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Scheduled Date</label>
                <p className="text-neutral-900">{selectedDonation.scheduledDate ? new Date(selectedDonation.scheduledDate).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Actual Date</label>
                <p className="text-neutral-900">{selectedDonation.actualDate ? new Date(selectedDonation.actualDate).toLocaleString() : '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Created</label>
                <p className="text-neutral-900">{new Date(selectedDonation.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {selectedDonation.additionalNotes && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Notes</label>
                <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">{selectedDonation.additionalNotes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Recipient Respond Modal */}
      <Modal
        isOpen={showRespondModal}
        onClose={() => setShowRespondModal(false)}
        title="Respond to Donation"
        size="md"
      >
        {respondError && (
          <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200">{respondError}</div>
        )}
        <RespondToDonationForm
          onSubmit={(data) => respondMutation.mutate({ id: respondDonation?._id, data })}
          onCancel={() => setShowRespondModal(false)}
          isLoading={respondMutation.isLoading}
        />
      </Modal>

      {/* Admin View Responses + Update Donation Status Modal */}
      <Modal
        isOpen={showResponsesModal}
        onClose={() => setShowResponsesModal(false)}
        title="Recipient Responses"
        size="lg"
      >
        <div className="space-y-4">
          {responsesList.length === 0 ? (
            <p className="text-neutral-600">No responses yet.</p>
          ) : (
            <div className="space-y-3">
              {responsesList.map((r, idx) => (
                <div key={idx} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-neutral-900">{r.recipientId?.firstName ? `${r.recipientId.firstName} ${r.recipientId.lastName}` : r.recipientId}</div>
                    <div className="text-sm text-neutral-600">{r.response} • {r.respondedAt ? new Date(r.respondedAt).toLocaleString() : ''}</div>
                    {r.notes && <div className="text-sm text-neutral-700 mt-1">{r.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Update Donation Status</label>
            <div className="flex items-center space-x-3">
              <select
                value={donationStatus}
                onChange={(e) => setDonationStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                {['scheduled','in_progress','completed','tested','stored','distributed','discarded','cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Button
                onClick={() => statusMutation.mutate({ id: selectedDonation?._id, data: { status: donationStatus } })}
                isLoading={statusMutation.isLoading}
              >
                Update Status
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Create Donation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Record Blood Donation"
        size="lg"
      >
        {createError && (
          <div className="mb-4 px-4 py-3 rounded bg-red-50 text-red-700 border border-red-200">
            {createError}
          </div>
        )}
        <CreateDonationForm
          onSubmit={handleCreateDonation}
          onCancel={() => setShowCreateModal(false)}
          isLoading={createDonationMutation.isLoading}
        />
      </Modal>

    </div>
  );
};

// Create Donation Form Component (donor schedules their donation)
const CreateDonationForm = ({ onSubmit, onCancel, isLoading }) => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    requestId: '',
    donationType: 'whole_blood',
    bloodUnits: 1,
    scheduledDate: tomorrow,
    scheduledTime: '10:00',
    collectionSite: '',
    additionalNotes: ''
  });
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(''); // Clear previous errors
    
    // Client-side validation to avoid 400s
    if (!formData.collectionSite || formData.collectionSite.trim().length < 5) {
      setFormError('Collection site must be at least 5 characters.');
      return;
    }
    
    const bloodUnitsNum = parseInt(formData.bloodUnits, 10);
    if (isNaN(bloodUnitsNum) || bloodUnitsNum < 1 || bloodUnitsNum > 2) {
      setFormError('Blood units must be 1 or 2.');
      return;
    }
    
    // Validate date format and ensure it's in the future
    const scheduled = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    if (isNaN(scheduled.getTime())) {
      setFormError('Invalid date or time format.');
      return;
    }
    if (scheduled <= new Date()) {
      setFormError('Scheduled date and time must be in the future.');
      return;
    }
    
    // Ensure scheduledDate is in ISO8601 format (YYYY-MM-DD)
    const dateParts = formData.scheduledDate.split('-');
    if (dateParts.length !== 3) {
      setFormError('Invalid date format.');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="px-4 py-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Donation Type</label>
          <select
            name="donationType"
            value={formData.donationType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          >
            {['whole_blood', 'red_cells', 'platelets', 'plasma'].map((type) => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Units</label>
          <select
            name="bloodUnits"
            value={formData.bloodUnits}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          >
            {[1,2].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Scheduled Date</label>
          <input
            type="date"
            name="scheduledDate"
            value={formData.scheduledDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Scheduled Time</label>
          <input
            type="time"
            name="scheduledTime"
            value={formData.scheduledTime}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            required
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Collection Site</label>
          <input
            type="text"
            name="collectionSite"
            value={formData.collectionSite}
            onChange={handleChange}
            placeholder="e.g., City Blood Center, Main Branch"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          placeholder="Additional information about your donation..."
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
          Schedule Donation
        </Button>
      </div>
    </form>
  );
};

export default DonationsPage;

// Respond form component
const RespondToDonationForm = ({ onSubmit, onCancel, isLoading }) => {
  const [form, setForm] = useState({ response: 'accept', notes: '' });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Your Response</label>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input type="radio" name="response" value="accept" checked={form.response === 'accept'} onChange={(e) => setForm({ ...form, response: e.target.value })} />
            <span>Accept</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="radio" name="response" value="decline" checked={form.response === 'decline'} onChange={(e) => setForm({ ...form, response: e.target.value })} />
            <span>Decline</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Notes (optional)</label>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Submit</Button>
      </div>
    </form>
  );
};