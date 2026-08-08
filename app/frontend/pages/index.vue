<script setup lang="ts">
import { navigateTo } from '#imports';

import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

await navigateTo(authStore.isAuthenticated ? '/dashboard' : '/auth/login', {
  replace: true,
});
</script>
