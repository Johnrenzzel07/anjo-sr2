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
  const now = new Date();

  // Local date in YYYY-MM-DD format
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  // Local time in HH:mm format
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  const [formData, setFormData] = useState<ServiceRequestFormData>({
    requestedBy: '',
    department: '',
    contactEmail: '',
    contactPhone: '',
    dateOfRequest: today,
    timeOfRequest: currentTime,
    serviceCategory: '',
    requestUrgency: '',
    briefSubject: '',
    detailedDescription: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
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
    try {
      let attachmentUrls: string[] = [];

      // Upload files first if any
      if (attachments.length > 0) {
        setUploadingFiles(true);
        for (const file of attachments) {
          const uploadData = new FormData();
          uploadData.append('file', file);
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadData,
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            attachmentUrls.push(url);
          }
        }
        setUploadingFiles(false);
      }

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
          attachments: attachmentUrls,
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
      setUploadingFiles(false);
    }
  };

  const handleClear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    setFormData({
      requestedBy: user?.name || '',
      department: user?.department || '',
      contactEmail: user?.email || '',
      contactPhone: '',
      dateOfRequest: today,
      timeOfRequest: currentTime,
      serviceCategory: '',
      requestUrgency: '',
      briefSubject: '',
      detailedDescription: '',
    });
    setAttachments([]);
    setError('');
  };



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
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
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
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
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

          {/* Photo Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo Attachments (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                  >
                    <span>Upload photos</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setAttachments(Array.from(e.target.files));
                        }
                      }}
                    />
                  </label>
                  <p className="pl-1 text-gray-500">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </div>
            </div>
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 flex items-center gap-1">
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-blue-500 hover:text-red-500 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || uploadingFiles}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-md font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (uploadingFiles ? 'Uploading Photos...' : 'Submitting...') : 'Submit'}
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

