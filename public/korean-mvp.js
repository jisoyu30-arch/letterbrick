(function() {
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function submitWaitlist(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const emailInput = qs('input[type="email"]', form);
    const message = qs('[data-form-message]', form.parentElement);
    const email = emailInput.value.trim();
    const source = form.getAttribute('data-source') || 'korean-mvp';
    if (!email) return;

    const local = JSON.parse(localStorage.getItem('lb-korean-mvp-waitlist') || '[]');
    local.push({ email, source, savedAt: new Date().toISOString() });
    localStorage.setItem('lb-korean-mvp-waitlist', JSON.stringify(local));

    const success = form.getAttribute('data-success') || 'You are on the list.';
    const pending = form.getAttribute('data-pending') || 'Saving...';
    const offline = form.getAttribute('data-offline') || success;
    if (message) message.textContent = pending;

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source })
    }).then(function() {
      if (message) message.textContent = success;
      form.reset();
    }).catch(function() {
      if (message) message.textContent = offline;
      form.reset();
    });
  }

  document.querySelectorAll('[data-waitlist-form]').forEach(function(form) {
    form.addEventListener('submit', submitWaitlist);
  });
})();
