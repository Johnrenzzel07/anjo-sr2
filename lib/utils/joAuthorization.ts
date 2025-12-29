/**
 * Job Order Creation Authorization Utility
 * 
 * This module determines which departments are authorized to create Job Orders
 * based on the Service Request's service category.
 * 
 * Rules:
 * - Technical Support → IT Department can create JO
 * - Facility Maintenance → Maintenance Department can create JO
 * - Account/Billing Inquiry → Accounting Department can create JO
 * - General Inquiry → General Services Department can create JO
 * - Other → Only Operations can create JO
 * - President can create JO for ANY service category
 */

// Mapping of service categories to authorized departments
const SERVICE_CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
  'Technical Support': ['it'],
  'Facility Maintenance': ['maintenance'],
  'Account/Billing Inquiry': ['accounting'],
  'General Inquiry': ['general services'],
  'Other': ['operations'], // Only Operations can create JO for "Other" category
};

// Reverse mapping: Department to service categories they handle
const DEPARTMENT_TO_SERVICE_CATEGORIES: Record<string, string[]> = {
  'it': ['Technical Support'],
  'maintenance': ['Facility Maintenance'],
  'accounting': ['Account/Billing Inquiry'],
  'general services': ['General Inquiry'],
  'operations': ['Other'],
  'president': ['Technical Support', 'Facility Maintenance', 'Account/Billing Inquiry', 'General Inquiry', 'Other'], // President sees all
};

/**
 * Get the service categories that a department is authorized to handle
 * 
 * @param department - The department name
 * @returns Array of service categories this department can handle
 */
export function getServiceCategoriesForDepartment(department: string | undefined): string[] {
  if (!department) return [];
  
  const normalizedDept = normalizeDepartment(department);
  
  // President can handle all categories
  if (normalizedDept === 'president') {
    return DEPARTMENT_TO_SERVICE_CATEGORIES['president'];
  }
  
  return DEPARTMENT_TO_SERVICE_CATEGORIES[normalizedDept] || [];
}

/**
 * Normalize department name for comparison
 * Handles variations like "IT" vs "IT Department"
 */
export function normalizeDepartment(department: string | undefined): string {
  if (!department) return '';
  return department.toLowerCase().replace(/\s+department$/, '').trim();
}

/**
 * Check if a user is authorized to create a Job Order for a given service category
 * 
 * @param userDepartment - The department of the user attempting to create the JO
 * @param serviceCategory - The service category of the Service Request
 * @returns true if the user is authorized, false otherwise
 */
export function canCreateJobOrder(
  userDepartment: string | undefined,
  serviceCategory: string
): boolean {
  const normalizedUserDept = normalizeDepartment(userDepartment);
  
  // President can create JO for any service category
  if (normalizedUserDept === 'president') {
    return true;
  }
  
  // Get authorized departments for this service category
  const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];
  
  if (!authorizedDepts) {
    // If service category is not in our mapping, only Operations can create JO
    return normalizedUserDept === 'operations';
  }
  
  // Check if user's department is in the list of authorized departments
  return authorizedDepts.includes(normalizedUserDept);
}

/**
 * Get the authorized department(s) for a given service category
 * Useful for displaying which department should handle the request
 * 
 * @param serviceCategory - The service category of the Service Request
 * @returns Array of department names that can create JO for this category
 */
export function getAuthorizedDepartments(serviceCategory: string): string[] {
  const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];
  
  if (!authorizedDepts) {
    return ['Operations'];
  }
  
  // Capitalize first letter of each department
  return authorizedDepts.map(dept => 
    dept.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  );
}

/**
 * Get a human-readable message explaining who can create the JO
 * 
 * @param serviceCategory - The service category of the Service Request
 * @returns A message explaining which department should create the JO
 */
export function getAuthorizationMessage(serviceCategory: string): string {
  const authorizedDepts = getAuthorizedDepartments(serviceCategory);
  
  if (authorizedDepts.length === 1) {
    return `Only ${authorizedDepts[0]} Department can create Job Orders for "${serviceCategory}" service requests.`;
  }
  
  const deptList = authorizedDepts.slice(0, -1).join(', ') + ' or ' + authorizedDepts[authorizedDepts.length - 1];
  return `Only ${deptList} Department can create Job Orders for "${serviceCategory}" service requests.`;
}

