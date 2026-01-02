'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ServiceRequestFormData {
  requestedBy: string;
  department: string;
  contactEmail: string;
  contactPhone: string;
  dateOfRequest: string;
  timeOfRequest: string;
  serviceCategory: string;
  requestUrgency: string;
  briefSubject: string;
  detailedDescription: string;
}

const departments = [
  'Maintenance',
  'IT Department',
  'Operations',
  'HR',
  'Sales',
  'Finance',
  'Marketing',
  'Belmont One',
  'Accounting',
  'General Services',
];

const serviceCategories = [
  'Technical Support',
  'Facility Maintenance',
  'Account/Billing Inquiry',
  'General Inquiry',
  'Other',
];

const urgencyLevels = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function ServiceRequestForm() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState<ServiceRequestFormData>({
    requestedBy: '',
    department: '',
    contactEmail: '',
    contactPhone: '',
    dateOfRequest: '',
    timeOfRequest: '',
    serviceCategory: '',
    requestUrgency: '',
    briefSubject: '',
    detailedDescription: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        requestedBy: user.name,
        contactEmail: user.email,
        department: user.department || '',
        contactPhone: user.phone || '',
      }));
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Validation
    if (!formData.serviceCategory || formData.serviceCategory === 'Choose') {
      setError('Please select a Service Category');
      setIsSubmitting(false);
      return;
    }

    if (!formData.requestUrgency || formData.requestUrgency === 'Choose') {
      setError('Please select Request Urgency');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          contactPerson: formData.requestedBy,
          priority: formData.requestUrgency,
          workDescription: formData.detailedDescription,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const srId = data.serviceRequest._id || data.serviceRequest.id;
        router.push(`/service-requests/${srId}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to submit service request');
      }
    } catch (err) {
      setError('An error occurred while submitting the form');
      console.error('Error submitting form:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      requestedBy: user?.name || '',
      department: user?.department || '',
      contactEmail: user?.email || '',
      contactPhone: '',
      dateOfRequest: '',
      timeOfRequest: '',
      serviceCategory: '',
      requestUrgency: '',
      briefSubject: '',
      detailedDescription: '',
    });
    setError('');
  };

  // Get today's date in YYYY-MM-DD format for date input
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Logo */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="/logo.png"
              alt="ANJO WORLD"
              className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">AWTP / AWCC Service Request Form</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-1">Anjo World - Funtastic World of Surprises</p>
          <p className="text-xs sm:text-sm text-gray-500">Please fill out this form to submit a new service request to our team.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {/* Requester Name */}
          <div>
            <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 mb-1">
              Requester Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="requestedBy"
              name="requestedBy"
              value={formData.requestedBy}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Department */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              value={formData.contactEmail}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              id="contactPhone"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date of Request */}
            <div>
              <label htmlFor="dateOfRequest" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Request
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="dateOfRequest"
                  name="dateOfRequest"
                  value={formData.dateOfRequest}
                  onChange={handleChange}
                  max={today}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute right-3 top-2.5 pointer-events-none">
                  📅
                </div>
              </div>
            </div>

            {/* Time */}
            <div>
              <label htmlFor="timeOfRequest" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  id="timeOfRequest"
                  name="timeOfRequest"
                  value={formData.timeOfRequest}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute right-3 top-2.5 pointer-events-none">
                  🕐
                </div>
              </div>
            </div>
          </div>

          {/* Service Category */}
          <div>
            <label htmlFor="serviceCategory" className="block text-sm font-medium text-gray-700 mb-1">
              Service Category <span className="text-red-500">*</span>
            </label>
            <select
              id="serviceCategory"
              name="serviceCategory"
              value={formData.serviceCategory}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="Choose">Choose</option>
              {serviceCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Request Urgency */}
          <div>
            <label htmlFor="requestUrgency" className="block text-sm font-medium text-gray-700 mb-1">
              Request Urgency <span className="text-red-500">*</span>
            </label>
            <select
              id="requestUrgency"
              name="requestUrgency"
              value={formData.requestUrgency}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="Choose">Choose</option>
              {urgencyLevels.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </div>

          {/* Brief Subject / Summary */}
          <div>
            <label htmlFor="briefSubject" className="block text-sm font-medium text-gray-700 mb-1">
              Brief Subject / Summary <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="briefSubject"
              name="briefSubject"
              value={formData.briefSubject}
              onChange={handleChange}
              required
              placeholder="Short description of your request"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Detailed Description */}
          <div>
            <label htmlFor="detailedDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="detailedDescription"
              name="detailedDescription"
              value={formData.detailedDescription}
              onChange={handleChange}
              required
              rows={6}
              placeholder="Describe the issue or service needed, including any relevant details."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-md font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-md font-medium border-2 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Clear form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

