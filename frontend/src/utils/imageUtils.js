// Utility function to fix image URLs for frontend display
export const fixImageUrl = (imageUrl) => {
  if (!imageUrl) return imageUrl;
  
  // If it's already a full URL or base64 data URI, return as is
  if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 
    (import.meta.env.DEV ? 'http://localhost:5000' : 'https://varda-menu-display-system.onrender.com');

  // If it's a relative URL starting with /
  if (imageUrl.startsWith('/')) {
    return `${backendUrl}${imageUrl}`;
  }
  
  // If it's a relative URL starting with uploads/ or uploads\
  if (imageUrl.startsWith('uploads/') || imageUrl.startsWith('uploads\\')) {
    return `${backendUrl}/${imageUrl.replace(/\\/g, '/')}`;
  }
  
  return imageUrl;
};

// Utility function to fix menu data with image URLs
export const fixMenuImageUrls = (menu) => {
  if (!menu) return menu;
  
  const fixed = { ...menu };
  
  // Fix menu images
  if (fixed.images && Array.isArray(fixed.images)) {
    fixed.images = fixed.images.map(image => ({
      ...image,
      imageUrl: fixImageUrl(image.imageUrl)
    }));
  }
  
  // Fix menu items with images
  if (fixed.menuItems && Array.isArray(fixed.menuItems)) {
    fixed.menuItems = fixed.menuItems.map(item => ({
      ...item,
      imageUrl: fixImageUrl(item.imageUrl)
    }));
  }
  
  // Fix background image
  if (fixed.design && fixed.design.backgroundImage) {
    fixed.design.backgroundImage = fixImageUrl(fixed.design.backgroundImage);
  }
  
  return fixed;
}; 